import json
from rest_framework import serializers

from .models import Salon
from .media_utils import save_image_to_media, build_full_media_url


class SalonSerializer(serializers.ModelSerializer):
    owner_email = serializers.ReadOnlyField(source="owner.email")
    approval_status = serializers.ReadOnlyField()

    class Meta:
        model = Salon
        fields = [
            "id",
            "owner",
            "owner_email",
            "name",
            "category",
            "description",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "pincode",
            "latitude",
            "longitude",
            "opening_hours",
            "amenities",
            "services",
            "cover_image",
            "images",
            "approval_status",
            "admin_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "approval_status", "created_at", "updated_at"]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)

        # Coordinate precision handling
        for field in ("latitude", "longitude"):
            if field in data:
                val = data[field]
                if val in (None, "", "null"):
                    data[field] = None
                else:
                    try:
                        data[field] = f"{float(val):.6f}"
                    except (ValueError, TypeError):
                        pass

        # Save cover image to MEDIA_ROOT if base64 or UploadedFile
        if "cover_image" in data and data["cover_image"]:
            data["cover_image"] = save_image_to_media(data["cover_image"], subfolder="salons/covers")

        # Save gallery images to MEDIA_ROOT if base64 or UploadedFiles
        if "images" in data and data["images"]:
            raw_imgs = data["images"]
            if isinstance(raw_imgs, str):
                try:
                    raw_imgs = json.loads(raw_imgs)
                except Exception:
                    raw_imgs = [raw_imgs]

            if isinstance(raw_imgs, list):
                saved_list = []
                for img in raw_imgs:
                    saved_path = save_image_to_media(img, subfolder="salons/gallery")
                    if saved_path:
                        saved_list.append(saved_path)
                data["images"] = saved_list

                # If cover_image is empty, default to first gallery image path
                if not data.get("cover_image") and saved_list:
                    data["cover_image"] = saved_list[0]

        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        if ret.get("cover_image"):
            ret["cover_image"] = build_full_media_url(request, ret["cover_image"])
        if isinstance(ret.get("images"), list):
            ret["images"] = [build_full_media_url(request, img) for img in ret["images"]]
        return ret