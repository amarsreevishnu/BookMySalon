from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from salons.models import Salon
from .models import ServiceCategory, Service, SalonService
from .permissions import (
    IsSuperAdmin,
    IsSalonOwner,
    IsSalonOwnerOfOffering,
)
from .serializers import (
    ServiceCategorySerializer,
    ServiceSerializer,
    ServiceCategoryWithServicesSerializer,
    SalonServiceSerializer,
)




class AdminCategoryListCreateView(APIView):
    """
    Super Admin: List all service categories (active + inactive) or create a new category.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        categories = ServiceCategory.objects.annotate(
            total_services=Count("services")
        ).order_by("display_order", "name")
        serializer = ServiceCategorySerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            serializer = ServiceCategorySerializer(data=request.data)
            if serializer.is_valid():
                category = serializer.save()
                return Response(ServiceCategorySerializer(category).data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Failed to create category: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class AdminCategoryDetailView(APIView):
    """
    Super Admin: Retrieve, update (edit/deactivate), or delete a category.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    authentication_classes = [JWTAuthentication]

    def get_object(self, pk):
        return get_object_or_404(ServiceCategory, pk=pk)

    def get(self, request, pk):
        category = self.get_object(pk)
        serializer = ServiceCategorySerializer(category)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        try:
            category = self.get_object(pk)
            serializer = ServiceCategorySerializer(category, data=request.data, partial=True)
            if serializer.is_valid():
                category = serializer.save()
                return Response(ServiceCategorySerializer(category).data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Failed to update category: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        category = self.get_object(pk)
        category_name = category.name
        category.delete()
        return Response(
            {"message": f"Category '{category_name}' deleted successfully."},
            status=status.HTTP_200_OK,
        )


class AdminServiceListCreateView(APIView):
    """
    Super Admin: List all platform catalog services or create a standard service.
    Supports query parameters:
      - category_id
      - is_active (true/false)
      - q (search by name/description)
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        qs = Service.objects.select_related("category").all()

        category_id = request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == "true")

        q = request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))

        qs = qs.order_by("category__display_order", "name")
        serializer = ServiceSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        try:
            serializer = ServiceSerializer(data=request.data)
            if serializer.is_valid():
                service = serializer.save()
                return Response(ServiceSerializer(service).data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Failed to save service: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class AdminServiceDetailView(APIView):
    """
    Super Admin: Retrieve, update (edit/deactivate), or delete a standard service.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    authentication_classes = [JWTAuthentication]

    def get_object(self, pk):
        return get_object_or_404(Service.objects.select_related("category"), pk=pk)

    def get(self, request, pk):
        service = self.get_object(pk)
        serializer = ServiceSerializer(service)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        try:
            service = self.get_object(pk)
            serializer = ServiceSerializer(service, data=request.data, partial=True)
            if serializer.is_valid():
                service = serializer.save()
                return Response(ServiceSerializer(service).data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"error": f"Failed to update service: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        service = self.get_object(pk)
        name = service.name
        service.delete()
        return Response(
            {"message": f"Service '{name}' deleted successfully from catalog."},
            status=status.HTTP_200_OK,
        )


class AdminServicesStatsView(APIView):
    """
    Super Admin: Dashboard analytics for catalog services.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        total_categories = ServiceCategory.objects.count()
        active_categories = ServiceCategory.objects.filter(is_active=True).count()
        inactive_categories = total_categories - active_categories

        total_services = Service.objects.count()
        active_services = Service.objects.filter(is_active=True).count()
        inactive_services = total_services - active_services

        total_salon_offerings = SalonService.objects.count()
        active_salon_offerings = SalonService.objects.filter(is_active=True).count()

        categories_summary = []
        for cat in ServiceCategory.objects.all():
            services_count = cat.services.count()
            active_cat_services = cat.services.filter(is_active=True).count()
            offerings_count = SalonService.objects.filter(service__category=cat).count()
            categories_summary.append({
                "id": cat.id,
                "name": cat.name,
                "icon": cat.icon,
                "is_active": cat.is_active,
                "services_count": services_count,
                "active_services_count": active_cat_services,
                "offerings_count": offerings_count,
            })

        return Response({
            "categories": {
                "total": total_categories,
                "active": active_categories,
                "inactive": inactive_categories,
            },
            "services": {
                "total": total_services,
                "active": active_services,
                "inactive": inactive_services,
            },
            "salon_offerings": {
                "total": total_salon_offerings,
                "active": active_salon_offerings,
            },
            "categories_summary": categories_summary,
        }, status=status.HTTP_200_OK)


class AdminSeedInitialServicesView(APIView):
    """
    Super Admin / Auto-seed utility: Populates standard starter catalog
    (Hair, Skin, Spa, Nails) if not already populated.
    """
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        starter_data = [
            {
                "name": "Hair",
                "icon": "✂️",
                "description": "Haircuts, styling, coloring, botanical wash and treatments.",
                "services": [
                    {"name": "Precision Haircut & Styling", "price": 450, "duration": 40, "gender": "ALL"},
                    {"name": "Beard Sculpt & Razor Detailing", "price": 250, "duration": 25, "gender": "MALE"},
                    {"name": "Organic Botanical Scalp Therapy", "price": 850, "duration": 45, "gender": "ALL"},
                    {"name": "Balayage & Hair Glossing", "price": 2800, "duration": 120, "gender": "FEMALE"},
                    {"name": "Keratin Protein Smoothing", "price": 3500, "duration": 150, "gender": "ALL"},
                ],
            },
            {
                "name": "Skin",
                "icon": "✨",
                "description": "Dermatological facials, cleanups, exfoliations and skin brightening.",
                "services": [
                    {"name": "Hydra Glow Oxygen Facial", "price": 1800, "duration": 60, "gender": "ALL"},
                    {"name": "Deep Pore Extraction & Cleanup", "price": 750, "duration": 35, "gender": "ALL"},
                    {"name": "Collagen Age-Defying Therapy", "price": 2400, "duration": 75, "gender": "ALL"},
                    {"name": "Charcoal Detox Clarifying Mask", "price": 600, "duration": 30, "gender": "ALL"},
                ],
            },
            {
                "name": "Spa",
                "icon": "🌿",
                "description": "Holistic body therapies, tension relief and deep relaxation.",
                "services": [
                    {"name": "Swedish Full Body Massage", "price": 2200, "duration": 60, "gender": "ALL"},
                    {"name": "Aromatherapy Herbal Relaxation", "price": 2500, "duration": 75, "gender": "ALL"},
                    {"name": "Hot Stone Destress Therapy", "price": 3000, "duration": 90, "gender": "ALL"},
                    {"name": "Foot Reflexology & Acupressure", "price": 800, "duration": 40, "gender": "ALL"},
                ],
            },
            {
                "name": "Nails",
                "icon": "💅",
                "description": "Express and luxury manicures, pedicures, and nail art.",
                "services": [
                    {"name": "Express Gel Manicure", "price": 650, "duration": 40, "gender": "ALL"},
                    {"name": "Botanical Spa Pedicure & Scrub", "price": 850, "duration": 50, "gender": "ALL"},
                    {"name": "Custom Gel Nail Extension & Art", "price": 1800, "duration": 90, "gender": "FEMALE"},
                ],
            },
        ]

        created_categories = 0
        created_services = 0

        for order, cat_data in enumerate(starter_data):
            category, cat_created = ServiceCategory.objects.get_or_create(
                name=cat_data["name"],
                defaults={
                    "icon": cat_data["icon"],
                    "description": cat_data["description"],
                    "display_order": order,
                    "is_active": True,
                },
            )
            if cat_created:
                created_categories += 1

            for s_data in cat_data["services"]:
                _, s_created = Service.objects.get_or_create(
                    category=category,
                    name=s_data["name"],
                    defaults={
                        "standard_price": s_data["price"],
                        "standard_duration": s_data["duration"],
                        "gender_target": s_data["gender"],
                        "is_active": True,
                    },
                )
                if s_created:
                    created_services += 1

        return Response({
            "message": "Starter catalog verified / seeded successfully.",
            "new_categories_created": created_categories,
            "new_services_created": created_services,
            "total_categories": ServiceCategory.objects.count(),
            "total_services": Service.objects.count(),
        }, status=status.HTTP_200_OK)




class OwnerStandardCatalogListView(APIView):
    """
    Salon Owner: Browse standard catalog services available on the platform
    to add to their salon's offerings.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        active_categories = ServiceCategory.objects.filter(is_active=True).prefetch_related(
            "services"
        ).order_by("display_order", "name")

        serializer = ServiceCategoryWithServicesSerializer(active_categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OwnerSalonServiceListCreateView(APIView):
    """
    Salon Owner: List own salon's services or add a standard service with custom price/duration.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner]
    authentication_classes = [JWTAuthentication]

    def get_salon(self, request):
        user = request.user
        salon_id = request.query_params.get("salon_id")
        if salon_id:
            return get_object_or_404(Salon, pk=salon_id, owner=user)
        return Salon.objects.filter(owner=user).first()

    def get(self, request):
        salon = self.get_salon(request)
        if not salon:
            return Response(
                {"error": "No registered salon found for this owner."},
                status=status.HTTP_404_NOT_FOUND,
            )

        offerings = SalonService.objects.filter(salon=salon).select_related(
            "service", "service__category"
        ).order_by("service__category__display_order", "service__name")

        serializer = SalonServiceSerializer(offerings, many=True)
        return Response({
            "salon": {
                "id": salon.id,
                "name": salon.name,
                "city": salon.city,
            },
            "count": offerings.count(),
            "services": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        salon = self.get_salon(request)
        if not salon:
            return Response(
                {"error": "No registered salon found for this owner."},
                status=status.HTTP_404_NOT_FOUND,
            )

        service_id = request.data.get("service")
        if not service_id:
            return Response(
                {"error": "Standard service ID ('service') is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        standard_service = get_object_or_404(Service, pk=service_id, is_active=True)

        # Check for duplicate
        if SalonService.objects.filter(salon=salon, service=standard_service).exists():
            return Response(
                {"error": f"Service '{standard_service.name}' is already added to your salon. You can edit its price or duration instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        price = request.data.get("price", standard_service.standard_price)
        duration = request.data.get("duration", standard_service.standard_duration)
        custom_name = request.data.get("custom_name", "")
        description = request.data.get("description", standard_service.description)

        offering = SalonService.objects.create(
            salon=salon,
            service=standard_service,
            custom_name=custom_name,
            price=price,
            duration=duration,
            description=description,
            is_active=True,
        )

        serializer = SalonServiceSerializer(offering)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OwnerSalonServiceDetailView(APIView):
    """
    Salon Owner: Retrieve, update price/duration/status, or remove a service offering.
    """
    permission_classes = [IsAuthenticated, IsSalonOwner, IsSalonOwnerOfOffering]
    authentication_classes = [JWTAuthentication]

    def get_object(self, pk, user):
        offering = get_object_or_404(
            SalonService.objects.select_related("salon", "service", "service__category"),
            pk=pk
        )
        self.check_object_permissions(self.request, offering)
        return offering

    def get(self, request, pk):
        offering = self.get_object(pk, request.user)
        serializer = SalonServiceSerializer(offering)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        offering = self.get_object(pk, request.user)
        serializer = SalonServiceSerializer(offering, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        offering = self.get_object(pk, request.user)
        name = offering.effective_name
        offering.delete()
        return Response(
            {"message": f"Service '{name}' removed from your salon."},
            status=status.HTTP_200_OK,
        )




class PublicCategoriesListView(APIView):
    """
    Public / Customer: Browse platform service categories and active services.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        categories = ServiceCategory.objects.filter(is_active=True).prefetch_related(
            "services"
        ).order_by("display_order", "name")
        serializer = ServiceCategoryWithServicesSerializer(categories, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PublicSalonServicesListView(APIView):
    """
    Public / Customer: View and compare active services offered at a specific salon.
    """
    permission_classes = [AllowAny]

    def get(self, request, salon_id):
        salon = get_object_or_404(Salon, pk=salon_id)
        offerings = SalonService.objects.filter(
            salon=salon,
            is_active=True,
            service__is_active=True,
            service__category__is_active=True
        ).select_related("service", "service__category").order_by(
            "service__category__display_order", "service__name"
        )

        serializer = SalonServiceSerializer(offerings, many=True)
        return Response({
            "salon": {
                "id": salon.id,
                "name": salon.name,
                "city": salon.city,
                "address": salon.address,
            },
            "count": offerings.count(),
            "services": serializer.data,
        }, status=status.HTTP_200_OK)
