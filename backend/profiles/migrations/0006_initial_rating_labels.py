from django.db import migrations


def seed_catalog(apps, schema_editor):
    Label = apps.get_model('profiles', 'Label')
    catalog = [
        ('Helpful', [2, 3]), ('Good teammate', [2, 3]), ('Community contributor', [2, 3]),
        ('Respectful', [2, 3]), ('Unreliable teammate', [1, 2]), ('Disruptive', [1, 2]),
        ('Aggressive behavior', [1]), ('Disrespectful', [1]), ('Other', [1]),
    ]
    for name, stars in catalog:
        Label.objects.using(schema_editor.connection.alias).get_or_create(name__iexact=name,
            defaults={'name': name, 'allowed_stars': stars, 'active': True})


class Migration(migrations.Migration):
    dependencies = [('profiles', '0005_studentprofile_accent_studentprofile_onboarded_and_more')]
    operations = [migrations.RunPython(seed_catalog, migrations.RunPython.noop)]
