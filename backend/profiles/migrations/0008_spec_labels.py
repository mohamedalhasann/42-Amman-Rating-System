from django.db import migrations


def add_spec_labels(apps, schema_editor):
    """Labels from the hackathon spec table. Small issues are available at 2 and 1 star, serious flags at 1."""
    Label = apps.get_model('profiles', 'Label')
    catalog = [
        ('Fair', [2, 3]), ('Thorough', [2, 3]), ('Clear explainer', [2, 3]), ('Helpful feedback', [2, 3]),
        ('Well prepared', [2, 3]), ('Knows their code', [2, 3]), ('Open to feedback', [2, 3]),
        ('Rushed', [1, 2]), ('Late', [1, 2]), ('Defensive', [1, 2]),
        ('Bad evaluator', [1]), ('Unprepared', [1]),
    ]
    for name, stars in catalog:
        Label.objects.using(schema_editor.connection.alias).get_or_create(name__iexact=name,
            defaults={'name': name, 'allowed_stars': stars, 'active': True})


class Migration(migrations.Migration):
    dependencies = [('profiles', '0007_detection_output')]
    operations = [migrations.RunPython(add_spec_labels, migrations.RunPython.noop)]
