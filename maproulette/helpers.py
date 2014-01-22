"""Some helper functions"""
from flask import abort, session, make_response, current_app
from maproulette.client.model import Challenge
from maproulette.challengetypes import challenge_types
from functools import wraps
import random
import json


def osmerror(error, description):
    """Return an OSMError to the client"""

    response = make_response("%s: %s" % (error, description), 400)
    return response

def osmlogin_required(f):
    """Require the caller to be authenticated against OSM"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_app.logger.debug('osm login required. app.debug is %s' % (current_app.debug, ))
        if not current_app.debug and not 'osm_token' in session:
            abort(403)
        return f(*args, **kwargs)
    return decorated_function


def localonly(f):
    """Restricts the view to only localhost. If there is a proxy, it
    will handle that too"""

    @wraps(f)
    def decorated_function(*args, **hwargs):
        # FIXME request is not defined here
        if not request.headers.getlist("X-Forwarded-For"):
            ip = request.remote_addr
        else:
            ip = request.headers.getlist("X-Forwarded-For")[0]
        if not ip == "127.0.0.1":
            abort(404)


def get_or_abort(model, object_id, code=404):
    """Get an object with his given id or an abort error (404 is the default)"""
    result = model.query.get(object_id)
    return result or abort(code)


def get_challenge_or_404(challenge_slug, instance_type=None,
                         abort_if_inactive=True):
    """Return a challenge by its id or return 404.

    If instance_type is True, return the correct Challenge Type"""

    c = Challenge.query.filter(Challenge.slug == challenge_slug).first()
    if not c or (abort_if_inactive and not c.active):
        abort(404)
    if instance_type:
        challenge_class = challenge_types[c.type]
        challenge = challenge_class.query.filter(Challenge.id == c.id).first()
        return challenge
    else:
        return c

class GeoPoint(object):
    """A geo-point class for use as a validation in the req parser"""

    def __init__(self, value):
        lon, lat = value.split('|')
        lat = float(lat)
        lon = float(lon)
        if not lat >= -90 and lat <= 90:
            raise ValueError("latitude must be between -90 and 90")
        if not lon >= -180 and lon <= 180:
            raise ValueError("longitude must be between -180 and 180")
        self.lat = lat
        self.lon = lon


class JsonData(object):
    """A simple class for use as a validation that a manifest is valid"""

    def __init__(self, value):
        self.data = json.loads(value)

    @property
    def json(self):
        return self.dumps(self.data)


class JsonTasks(object):
    """A class for validation of a mass tasks insert"""

    def __init__(self, value):
        data = json.loads(value)
        assert isinstance(data, list)
        for task in data:
            assert 'id' in task, "Task must contain an 'id' property"
            assert 'manifest' in task, "Task must contain a 'manifest' property"
            assert 'location' in task, "Task must contain a 'location' property"
        self.data = data
