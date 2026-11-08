from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import AccountAudit, AccountSettings, ImportRun, StudentProfile, User

@admin.register(User)
class AccountAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (('Application access', {'fields': ('role', 'email_verified_at', 'approved_at', 'approved_by')}),)


class EligibilityFilter(admin.SimpleListFilter):
    title = 'profile eligibility'
    parameter_name = 'eligibility'

    def lookups(self, request, model_admin):
        return [('eligible', 'Active 42cursus'), ('unchecked', 'Awaiting recheck'), ('excluded', 'Excluded'), ('all', 'All saved records')]

    def queryset(self, request, queryset):
        value = self.value() or 'eligible'
        return queryset if value == 'all' else queryset.filter(eligibility_status=value)

    def choices(self, changelist):
        for code, label in self.lookup_choices:
            yield {'selected': (self.value() or 'eligible') == code,
                   'query_string': changelist.get_query_string({self.parameter_name: code}), 'display': label}


@admin.register(StudentProfile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('intra_id', 'user', 'campus_id', 'intra_active', 'eligibility_status', 'profile_synced_at')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')
    list_filter = (EligibilityFilter,)
    readonly_fields = ('intra_id', 'user', 'campus_id', 'intra_active', 'eligibility_status', 'eligibility_policy', 'eligibility_checked_at', 'photo', 'profile_synced_at', 'photo_synced_at')

    def has_add_permission(self, request):
        return False

@admin.register(ImportRun)
class ImportRunAdmin(admin.ModelAdmin):
    list_display = ('started_at', 'campus_id', 'status', 'created', 'updated', 'skipped', 'failed')
    readonly_fields = tuple(field.name for field in ImportRun._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AccountAudit)
class AccountAuditAdmin(admin.ModelAdmin):
    list_display = ('occurred_at', 'action', 'actor', 'subject')
    readonly_fields = ('occurred_at', 'action', 'actor', 'subject', 'detail')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False
