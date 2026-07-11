import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination: function(req, file , cb){
        cb(null , "public")
    },
    filename: function(req , file , cb){
        // Sanitize the filename to prevent directory traversal and other injections
        const ext = path.extname(file.originalname).toLowerCase();
        const base = path.basename(file.originalname, ext);
        const cleanBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
        const filename = `${Date.now()}-${cleanBase}${ext}`;
        cb(null, filename);
    }
})

const fileFilter = (req, file, cb) => {
    // strictly allow only pdf files
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' || file.mimetype !== 'application/pdf') {
        return cb(new Error("Only PDF files are allowed"), false);
    }
    cb(null, true);
};

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter
});