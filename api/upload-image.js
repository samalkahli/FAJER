const Busboy = require("busboy");
const { getDatabase, authorize, cors, json: sendJson } = require("../lib/server-auth");

const MAX_FILE_SIZE = 4 * 1024 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function isValidImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  if (mimeType === "image/gif") {
    const signature = buffer.toString("ascii", 0, 6);
    return signature === "GIF87a" || signature === "GIF89a";
  }

  return false;
}

function readImage(req) {
  return new Promise((resolve, reject) => {
    let parser;

    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          files: 1,
          fields: 0,
          parts: 2,
          fileSize: MAX_FILE_SIZE
        }
      });
    } catch {
      reject(new Error("INVALID_FORM"));
      return;
    }

    let imageFound = false;
    let imageTooLarge = false;
    let invalidParts = false;
    let mimeType = "";
    const chunks = [];

    parser.on("file", (fieldName, file, info) => {
      if (fieldName !== "image" || imageFound) {
        file.resume();
        return;
      }

      imageFound = true;
      mimeType = info.mimeType;

      file.on("data", (chunk) => {
        chunks.push(chunk);
      });

      file.on("limit", () => {
        imageTooLarge = true;
      });

      file.on("error", reject);
    });

    parser.on("error", reject);
    parser.on("filesLimit", () => { invalidParts = true; });
    parser.on("fieldsLimit", () => { invalidParts = true; });
    parser.on("partsLimit", () => { invalidParts = true; });
    req.on("aborted", () => { parser.destroy(new Error("INVALID_FORM")); });
    req.on("error", reject);

    parser.on("finish", () => {
      if (invalidParts) { reject(new Error("INVALID_FORM")); return; }
      if (imageTooLarge) {
        reject(new Error("FILE_TOO_LARGE"));
        return;
      }

      if (!imageFound) {
        reject(new Error("IMAGE_REQUIRED"));
        return;
      }

      if (!allowedTypes.has(mimeType)) {
        reject(new Error("IMAGE_TYPE_NOT_ALLOWED"));
        return;
      }

      const buffer = Buffer.concat(chunks);

      if (!buffer.length) {
        reject(new Error("IMAGE_EMPTY"));
        return;
      }

      resolve({ buffer, mimeType });
    });

    req.pipe(parser);
  });
}

async function handler(req, res) {
  if (!cors(req, res)) {
    return sendJson(res, 403, {
      error: "هذا النطاق غير مسموح"
    });
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, {
      error: "الطلب غير مسموح"
    });
  }

  const user = await authorize(req, res);
  if (!user) return;
  // Persistent per-user counters work across serverless instances.
  try {
    const now = Date.now(), db = getDatabase(), ref = db.collection("_uploadLimits").doc(user.uid);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref), old = snap.data() || {};
      const minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
      const minuteCount = old.minute === minute ? old.minuteCount || 0 : 0;
      const dayCount = old.day === day ? old.dayCount || 0 : 0;
      if (minuteCount >= 60 || dayCount >= 500) throw new Error("RATE_LIMIT");
      tx.set(ref, { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
    });
  } catch (error) {
    if (error.message === "RATE_LIMIT") {
      res.setHeader("Retry-After", "60");
      return sendJson(res, 429, { error: "تم بلوغ حد الرفع. الحد 60 صورة بالدقيقة و500 باليوم لكل مدير" });
    }
    return sendJson(res, 503, { error: "تعذر التحقق من حد الرفع. راجع صلاحيات حساب الخادم على Firestore" });
  }

  if (!process.env.IMGBB_API_KEY) {
    return sendJson(res, 500, {
      error: "مفتاح رفع الصور غير موجود في الخادم"
    });
  }

  let image;

  try {
    image = await readImage(req);
  } catch (error) {
    const messages = {
      FILE_TOO_LARGE: "حجم الصورة يجب ألا يتجاوز 4 ميجابايت",
      IMAGE_REQUIRED: "لم يتم اختيار صورة",
      IMAGE_TYPE_NOT_ALLOWED: "صيغة الصورة غير مسموحة",
      IMAGE_EMPTY: "الصورة فارغة",
      INVALID_FORM: "بيانات الصورة غير صالحة"
    };

    return sendJson(res, 400, {
      error: messages[error.message] || "تعذر قراءة الصورة"
    });
  }

  if (!isValidImageSignature(image.buffer, image.mimeType)) {
    return sendJson(res, 400, {
      error: "ملف الصورة غير صالح"
    });
  }

  try {
    const form = new URLSearchParams();

    form.set("key", process.env.IMGBB_API_KEY);
    form.set("image", image.buffer.toString("base64"));

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(25000)
    });

    const result = await response.json();

    if (
      !response.ok ||
      !result.success ||
      !result.data ||
      !result.data.display_url
    ) {
      console.error("ImgBB upload failed", response.status);

      return sendJson(res, 502, {
        error: "تعذر رفع الصورة حاليًا"
      });
    }

    const imageUrl = result.data.display_url;

    if (!imageUrl.startsWith("https://i.ibb.co/")) {
      return sendJson(res, 502, {
        error: "رابط الصورة غير صالح"
      });
    }

    return sendJson(res, 200, {
      url: imageUrl
    });
  } catch (error) {
    console.error("Upload function failed");

    return sendJson(res, 500, {
      error: "حدث خطأ أثناء رفع الصورة"
    });
  }
}

module.exports = handler;

module.exports.config = {
  api: {
    bodyParser: false
  }
};
