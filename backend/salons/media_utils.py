import base64
import os
import uuid
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils.text import get_valid_filename
from rest_framework.exceptions import ValidationError

SUPPORTED_DOC_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
SUPPORTED_DOC_MIMES = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
}


def save_document_to_media(doc_data_or_file, subfolder="salons/documents"):
    """
    Saves an uploaded file or Base64 data string (PDF, JPG, JPEG, PNG) to Django MEDIA_ROOT,
    returning the clean web-accessible media path (e.g. '/media/salons/documents/xyz.pdf').
    
    Validates allowed formats: PDF, JPG, JPEG, PNG.
    Enforces maximum file size of 10MB.
    """
    if not doc_data_or_file:
        return ""

    # 1. Handle Django UploadedFile / File object
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

        clean_base = get_valid_filename(base_name) or "doc"
        unique_name = f"{clean_base}_{uuid.uuid4().hex[:8]}{ext}"
        relative_path = f"{subfolder.strip('/')}/{unique_name}"

        saved_name = default_storage.save(
            relative_path,
            ContentFile(doc_data_or_file.read())
        )
        return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"

    # 2. If it's a string
    if isinstance(doc_data_or_file, str):
        doc_str = doc_data_or_file.strip()

        # Existing web URL or existing media path
        if doc_str.startswith("http://") or doc_str.startswith("https://"):
            return doc_str
        if doc_str.startswith("/media/") or doc_str.startswith("media/"):
            return f"/{doc_str.lstrip('/')}"

        # Base64 Data URL (e.g. "data:application/pdf;base64,..." or "data:image/png;base64,...")
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
                    # Fallback: check magic bytes if MIME type is generic (e.g. application/octet-stream)
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
                relative_path = f"{subfolder.strip('/')}/{unique_name}"

                saved_name = default_storage.save(
                    relative_path,
                    ContentFile(file_bytes)
                )
                return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"
            except ValidationError:
                raise
            except Exception as e:
                raise ValidationError(f"Failed to process document upload: {str(e)}")

        # Raw base64 string without data: prefix
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
            relative_path = f"{subfolder.strip('/')}/{unique_name}"
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
    Saves an uploaded file or Base64 string to Django MEDIA_ROOT,
    returning the clean web-accessible media path (e.g. '/media/salons/covers/xyz.jpg').
    
    If the input is already an external URL (http/https) or an existing media path,
    it returns it unchanged.
    """
    if not image_data_or_file:
        return ""

    # 1. Handle Django UploadedFile / File object
    if hasattr(image_data_or_file, "read"):
        orig_name = getattr(image_data_or_file, "name", "upload.jpg")
        base_name, ext = os.path.splitext(orig_name)
        ext = ext.lower() if ext else ".jpg"
        clean_base = get_valid_filename(base_name) or "img"
        unique_name = f"{clean_base}_{uuid.uuid4().hex[:8]}{ext}"
        relative_path = f"{subfolder.strip('/')}/{unique_name}"
        
        saved_name = default_storage.save(
            relative_path,
            ContentFile(image_data_or_file.read())
        )
        return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"

    # If it's a string
    if isinstance(image_data_or_file, str):
        image_str = image_data_or_file.strip()

        # 2. Existing web URL (e.g. Unsplash or Cloudinary)
        if image_str.startswith("http://") or image_str.startswith("https://"):
            return image_str

        # 3. Already a media path
        if image_str.startswith("/media/") or image_str.startswith("media/"):
            return f"/{image_str.lstrip('/')}"

        # 4. Base64 Data URL (e.g. "data:image/jpeg;base64,/9j/4AAQSkZJR...")
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
                relative_path = f"{subfolder.strip('/')}/{unique_name}"

                saved_name = default_storage.save(
                    relative_path,
                    ContentFile(file_bytes)
                )
                return f"{settings.MEDIA_URL.rstrip('/')}/{saved_name.lstrip('/')}"
            except Exception as e:
                # If decoding fails, fallback to empty or raw
                print(f"[media_utils] Failed to decode base64 image: {e}")
                return ""

    return str(image_data_or_file)


def build_full_media_url(request, path):
    """
    Prepends the current domain/host to relative media paths.
    E.g. '/media/salons/covers/a.jpg' -> 'http://127.0.0.1:8000/media/salons/covers/a.jpg'
    """
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if request and path.startswith("/"):
        return request.build_absolute_uri(path)
    return path

