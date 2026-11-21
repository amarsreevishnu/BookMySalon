import base64
import io
import logging
import os
import uuid
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

SUPPORTED_DOC_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
SUPPORTED_DOC_MIMES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}


def is_cloudinary_configured():
    """
    Returns True only if Cloudinary is explicitly enabled and credentials are present.
    """
    return bool(
        getattr(settings, "USE_CLOUDINARY", False)
        and getattr(settings, "CLOUDINARY_CLOUD_NAME", "")
    )


def save_document_to_media(doc_data_or_file, subfolder="salons/documents"):
    """
    Saves an uploaded file or Base64 data string (PDF, JPG, JPEG, PNG) to Cloudinary or Django MEDIA_ROOT,
    returning the clean web-accessible media path (e.g. 'https://res.cloudinary.com/...' or '/media/salons/...').
    
    Validates allowed formats: PDF, JPG, JPEG, PNG.
    Enforces maximum file size of 10MB.
    """
    if not doc_data_or_file:
        return ""

    # 1. Existing web URL or existing media path
    if isinstance(doc_data_or_file, str):
        doc_str = doc_data_or_file.strip()
        if doc_str.startswith("http://") or doc_str.startswith("https://"):
            return doc_str
        if doc_str.startswith("/media/") or doc_str.startswith("media/"):
            return f"/{doc_str.lstrip('/')}"

    clean_subfolder = subfolder.strip("/")

    # 2. Upload to Cloudinary if configured
    if is_cloudinary_configured():
        try:
            import cloudinary.uploader

            # Handle Django UploadedFile / File object
            if hasattr(doc_data_or_file, "read"):
                orig_name = getattr(doc_data_or_file, "name", "document.pdf")
                base_name, ext = os.path.splitext(orig_name)
                ext = ext.lower() if ext else ".pdf"

                if ext not in SUPPORTED_DOC_EXTENSIONS:
                    raise ValidationError(
                        f"Unsupported document format '{ext}'. Allowed formats: PDF, JPG, JPEG, PNG."
                    )

                file_size = getattr(doc_data_or_file, "size", 0)
                if file_size > 10 * 1024 * 1024:
                    raise ValidationError("Document file size exceeds the 10MB limit.")

                if hasattr(doc_data_or_file, "seek"):
                    doc_data_or_file.seek(0)

                clean_base = get_valid_filename(base_name) or "doc"
                public_id = f"{clean_base}_{uuid.uuid4().hex[:8]}"

                res = cloudinary.uploader.upload(
                    doc_data_or_file,
                    folder=clean_subfolder,
                    public_id=public_id,
                    resource_type="auto",
                )
                return res.get("secure_url") or res.get("url") or ""

            # Handle string (Base64)
            if isinstance(doc_data_or_file, str):
                doc_str = doc_data_or_file.strip()
                if doc_str.startswith("data:"):
                    header, base64_payload = doc_str.split(";base64,", 1)
                    file_bytes = base64.b64decode(base64_payload)
                    if len(file_bytes) > 10 * 1024 * 1024:
                        raise ValidationError("Document file size exceeds the 10MB limit.")

                    public_id = f"doc_{uuid.uuid4().hex[:12]}"
                    res = cloudinary.uploader.upload(
                        doc_str,
                        folder=clean_subfolder,
                        public_id=public_id,
                        resource_type="auto",
                    )
                    return res.get("secure_url") or res.get("url") or ""

                if len(doc_str) >= 500:
                    file_bytes = base64.b64decode(doc_str)
                    if len(file_bytes) > 10 * 1024 * 1024:
                        raise ValidationError("Document file size exceeds the 10MB limit.")
                    public_id = f"doc_{uuid.uuid4().hex[:12]}"
                    res = cloudinary.uploader.upload(
                        io.BytesIO(file_bytes),
                        folder=clean_subfolder,
                        public_id=public_id,
                        resource_type="auto",
                    )
                    return res.get("secure_url") or res.get("url") or ""
        except ValidationError:
            raise
        except Exception as e:
            logger.error("Cloudinary document upload error: %s", e)
            raise ValidationError(f"Failed to process document upload: {str(e)}")

    # 3. Local disk fallback
    if hasattr(doc_data_or_file, "read"):
        if hasattr(doc_data_or_file, "seek"):
            doc_data_or_file.seek(0)
        orig_name = getattr(doc_data_or_file, "name", "document.pdf")
        base_name, ext = os.path.splitext(orig_name)
        ext = ext.lower() if ext else ".pdf"

        if ext not in SUPPORTED_DOC_EXTENSIONS:
            raise ValidationError(
                f"Unsupported document format '{ext}'. Allowed formats: PDF, JPG, JPEG, PNG."
            )

        file_size = getattr(doc_data_or_file, "size", 0)
        if file_size > 10 * 1024 * 1024:
            raise ValidationError("Document file size exceeds the 10MB limit.")

        clean_base = get_valid_filename(base_name) or "doc"
        unique_name = f"{clean_base}_{uuid.uuid4().hex[:8]}{ext}"
        relative_path = f"{clean_subfolder}/{unique_name}"

        saved_name = default_storage.save(
            relative_path,
            ContentFile(doc_data_or_file.read())
        )
        return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"

    if isinstance(doc_data_or_file, str):
        doc_str = doc_data_or_file.strip()
        if doc_str.startswith("data:"):
            try:
                header, base64_payload = doc_str.split(";base64,", 1)
                mime = header.replace("data:", "").lower()

                ext = None
                if "application/pdf" in mime or "pdf" in mime:
                    ext = ".pdf"
                elif "image/png" in mime or "png" in mime:
                    ext = ".png"
                elif "image/jpeg" in mime or "image/jpg" in mime or "jpeg" in mime or "jpg" in mime:
                    ext = ".jpg"
                else:
                    file_bytes = base64.b64decode(base64_payload)
                    if file_bytes.startswith(b"%PDF"):
                        ext = ".pdf"
                    elif file_bytes.startswith(b"\x89PNG"):
                        ext = ".png"
                    elif file_bytes.startswith(b"\xff\xd8\xff"):
                        ext = ".jpg"
                    else:
                        raise ValidationError("Unsupported document format. Allowed formats: PDF, JPG, JPEG, PNG.")

                if 'file_bytes' not in locals():
                    file_bytes = base64.b64decode(base64_payload)
                if len(file_bytes) > 10 * 1024 * 1024:
                    raise ValidationError("Document file size exceeds the 10MB limit.")

                unique_name = f"doc_{uuid.uuid4().hex[:12]}{ext}"
                relative_path = f"{clean_subfolder}/{unique_name}"

                saved_name = default_storage.save(
                    relative_path,
                    ContentFile(file_bytes)
                )
                return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"
            except ValidationError:
                raise
            except Exception as e:
                raise ValidationError(f"Failed to process document upload: {str(e)}")

        try:
            file_bytes = base64.b64decode(doc_str)
            ext = ".pdf"
            if file_bytes.startswith(b"%PDF"):
                ext = ".pdf"
            elif file_bytes.startswith(b"\x89PNG"):
                ext = ".png"
            elif file_bytes.startswith(b"\xff\xd8\xff"):
                ext = ".jpg"
            else:
                if len(doc_str) < 500:
                    return doc_str
                raise ValidationError("Unsupported document format. Allowed formats: PDF, JPG, JPEG, PNG.")

            if len(file_bytes) > 10 * 1024 * 1024:
                raise ValidationError("Document file size exceeds the 10MB limit.")

            unique_name = f"doc_{uuid.uuid4().hex[:12]}{ext}"
            relative_path = f"{clean_subfolder}/{unique_name}"
            saved_name = default_storage.save(
                relative_path,
                ContentFile(file_bytes)
            )
            return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"
        except ValidationError:
            raise
        except Exception:
            return doc_str

    return str(doc_data_or_file)


def save_image_to_media(image_data_or_file, subfolder="salons"):
    """
    Saves an uploaded file or Base64 string to Cloudinary (if configured) or local Django MEDIA_ROOT,
    returning the clean web-accessible media path (e.g. 'https://res.cloudinary.com/...' or '/media/salons/...').
    
    If the input is already an external URL (http/https) or an existing media path,
    it returns it unchanged.
    """
    if not image_data_or_file:
        return ""

    # 1. Existing web URL (e.g. Unsplash or Cloudinary) or existing media path
    if isinstance(image_data_or_file, str):
        image_str = image_data_or_file.strip()
        if image_str.startswith("http://") or image_str.startswith("https://"):
            return image_str
        if image_str.startswith("/media/") or image_str.startswith("media/"):
            return f"/{image_str.lstrip('/')}"

    clean_subfolder = subfolder.strip("/")

    # 2. Upload to Cloudinary if configured
    if is_cloudinary_configured():
        try:
            import cloudinary.uploader

            # Handle Django UploadedFile / File object
            if hasattr(image_data_or_file, "read"):
                if hasattr(image_data_or_file, "seek"):
                    image_data_or_file.seek(0)
                orig_name = getattr(image_data_or_file, "name", "upload.jpg")
                base_name, ext = os.path.splitext(orig_name)
                clean_base = get_valid_filename(base_name) or "img"
                public_id = f"{clean_base}_{uuid.uuid4().hex[:8]}"

                res = cloudinary.uploader.upload(
                    image_data_or_file,
                    folder=clean_subfolder,
                    public_id=public_id,
                    resource_type="image",
                )
                return res.get("secure_url") or res.get("url") or ""

            # Handle String (Base64 data URI or raw base64)
            if isinstance(image_data_or_file, str):
                image_str = image_data_or_file.strip()
                if image_str.startswith("data:image/"):
                    public_id = f"img_{uuid.uuid4().hex[:12]}"
                    res = cloudinary.uploader.upload(
                        image_str,
                        folder=clean_subfolder,
                        public_id=public_id,
                        resource_type="image",
                    )
                    return res.get("secure_url") or res.get("url") or ""

                if len(image_str) > 100:
                    try:
                        file_bytes = base64.b64decode(image_str)
                        public_id = f"img_{uuid.uuid4().hex[:12]}"
                        res = cloudinary.uploader.upload(
                            io.BytesIO(file_bytes),
                            folder=clean_subfolder,
                            public_id=public_id,
                            resource_type="image",
                        )
                        return res.get("secure_url") or res.get("url") or ""
                    except Exception:
                        pass
        except Exception as e:
            logger.error("Cloudinary image upload error: %s", e)
            raise ValidationError(f"Failed to upload image to cloud storage: {str(e)}")

    # 3. Local disk fallback
    if hasattr(image_data_or_file, "read"):
        if hasattr(image_data_or_file, "seek"):
            image_data_or_file.seek(0)
        orig_name = getattr(image_data_or_file, "name", "upload.jpg")
        base_name, ext = os.path.splitext(orig_name)
        ext = ext.lower() if ext else ".jpg"
        clean_base = get_valid_filename(base_name) or "img"
        unique_name = f"{clean_base}_{uuid.uuid4().hex[:8]}{ext}"
        relative_path = f"{clean_subfolder}/{unique_name}"
        
        saved_name = default_storage.save(
            relative_path,
            ContentFile(image_data_or_file.read())
        )
        return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"

    if isinstance(image_data_or_file, str):
        image_str = image_data_or_file.strip()
        if image_str.startswith("data:image/"):
            try:
                header, base64_payload = image_str.split(";base64,", 1)
                mime = header.replace("data:image/", "").lower()
                if "png" in mime:
                    ext = ".png"
                elif "webp" in mime:
                    ext = ".webp"
                elif "gif" in mime:
                    ext = ".gif"
                elif "svg" in mime:
                    ext = ".svg"
                else:
                    ext = ".jpg"

                file_bytes = base64.b64decode(base64_payload)
                unique_name = f"salon_{uuid.uuid4().hex[:12]}{ext}"
                relative_path = f"{clean_subfolder}/{unique_name}"

                saved_name = default_storage.save(
                    relative_path,
                    ContentFile(file_bytes)
                )
                return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"
            except Exception as e:
                logger.error("[media_utils] Failed to decode base64 image: %s", e)
                return ""

    return str(image_data_or_file)


def build_full_media_url(request, path):
    """
    Prepends the current domain/host to relative media paths.
    E.g. '/media/salons/covers/a.jpg' -> 'http://127.0.0.1:8000/media/salons/covers/a.jpg'
    External or Cloudinary URLs are returned as-is.
    """
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if request and path.startswith("/"):
        return request.build_absolute_uri(path)
    return path
