const Busboy = require("busboy");
const admin = require("firebase-admin");

const MAX_FILE_SIZE = 4 * 1024 * 1024;

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(data));
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  return (
    origin === "https://athnta-ten.vercel.app" ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

function setCors(req, res) {
  const origin = req.headers.origin || "";

  if (!isAllowedOrigin(origin)) {
    return false;
  }

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );

  return true;
}

function getAdminAuth() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = String(
    process.env.FIREBASE_ADMIN_PRIVATE_KEY || ""
  ).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_CONFIG_MISSING");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }

  return admin.auth();
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function getAdminUids() {
  return new Set(
    String(process.env.ADMIN_UIDS || "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean)
  );
}

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
          fileSize: MAX_FILE_SIZE
        }
      });
    } catch {
      reject(new Error("INVALID_FORM"));
      return;
    }

    let imageFound = false;
    let imageTooLarge = false;
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

    parser.on("finish", () => {
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
  if (!setCors(req, res)) {
    return sendJson(res, 403, {
      error: "هذا النطاق غير مسموح"
    });
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, {
      error: "الطلب غير مسموح"
    });
  }

  const token = getBearerToken(req);

  if (!token) {
    return sendJson(res, 401, {
      error: "يجب تسجيل الدخول أولًا"
    });
  }

  let firebaseAuth;

  try {
    firebaseAuth = getAdminAuth();
  } catch (error) {
    console.error("Firebase Admin configuration error");
    return sendJson(res, 500, {
      error: "إعدادات الخادم غير مكتملة"
    });
  }

  let decodedToken;

  try {
    decodedToken = await firebaseAuth.verifyIdToken(token);
  } catch {
    return sendJson(res, 401, {
      error: "جلسة الدخول غير صالحة"
    });
  }

  const adminUids = getAdminUids();

  if (!adminUids.has(decodedToken.uid)) {
    return sendJson(res, 403, {
      error: "ليس لديك صلاحية رفع الصور"
    });
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
      body: form
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
    console.error("Upload function failed", error.message);

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