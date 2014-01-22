from flask.ext.restful import reqparse, fields, marshal, \
    marshal_with, Api, Resource
from flask.ext.restful.fields import get_value, Raw
from flask.ext.sqlalchemy import get_debug_queries
from flask import session, make_response, Blueprint, current_app
from maproulette.helpers import get_challenge_or_404, \
     osmlogin_required, osmerror
from maproulette.client.model import Challenge
from geoalchemy2.functions import ST_Buffer
from shapely import geometry
import geojson
import json
from maproulette import db


mod = Blueprint('api', __name__)

class ProtectedResource(Resource):
    """A Resource that requires the caller to be authenticated against OSM"""
    method_decorators = [osmlogin_required]

challenge_summary = {
    'slug': fields.String,
    'title': fields.String,
    'difficulty': fields.Integer,
    'islocal': fields.Boolean
}

api = Api()

# override the default JSON representation to support the geo objects
@api.representation('application/json')
def output_json(data, code, headers=None):
    """Automatic JSON / GeoJSON output"""
    current_app.logger.debug(data)
    # return empty result if data contains nothing
    if not data:
        resp = make_response(geojson.dumps({}), code)
    # if this is a Shapely object, dump it as geojson
    elif isinstance(data, geometry.base.BaseGeometry):
        resp = make_response(geojson.dumps(data), code)
    # otherwise perform default json representation
    else:
        resp = make_response(json.dumps(data), code)
    # finish and return the response object
    resp.headers.extend(headers or {})
    return resp


class ApiChallengeList(ProtectedResource):
    """Challenges endpoint"""

    @marshal_with(challenge_summary)
    def get(self):
        """returns a list of challenges.
        Optional URL parameters are:
        difficulty: the desired difficulty to filter on (1=easy, 2=medium, 3=hard)
        lon/lat: the coordinate to filter on (returns only
        challenges whose bounding polygons contain this point)
        example: /api/c/challenges?lon=-100.22&lat=40.45&difficulty=2
        all: if true, return all challenges regardless of OSM user home location
        """
        # initialize the parser
        parser = reqparse.RequestParser()
        parser.add_argument('difficulty', type=int, choices=["1", "2", "3"],
                            help='difficulty cannot be parsed')
        parser.add_argument('lon', type=float,
                            help="lon cannot be parsed")
        parser.add_argument('lat', type=float,
                            help="lat cannot be parsed")
        parser.add_argument('all', type=bool,
                            help="all cannot be parsed")
        args = parser.parse_args()

        difficulty = None
        contains = None

        # Try to get difficulty from argument, or users preference
        difficulty = args['difficulty'] or session.get('difficulty')

        # for local challenges, first look at lon / lat passed in
        if args.lon and args.lat:
            contains = 'POINT(%s %s)' % (args.lon, args.lat)
        # if there is none, look at the user's home location from OSM
        elif 'home_location' in session:
            contains = 'POINT(%s %s)' % tuple(session['home_location'])

        # get the list of challenges meeting the criteria
        query = db.session.query(Challenge).filter(Challenge.active == True)

        if difficulty:
            query = query.filter(Challenge.difficulty == difficulty)
        if contains and not args.all:
            query = query.filter(Challenge.polygon.ST_Contains(contains))

        challenges = query.all()
        current_app.logger.debug(get_debug_queries())

        return challenges


class ApiChallengeDetail(ProtectedResource):
    """Single Challenge endpoint"""

    def get(self, slug):
        """Return a single challenge by slug"""
        challenge = get_challenge_or_404(slug, True)
        return marshal(challenge, challenge.marshal_fields)


class ApiChallengePolygon(ProtectedResource):
    """Challenge geometry endpoint"""

    def get(self, slug):
        """Return the geometry (spatial extent) for the challenge identified by 'slug'"""
        challenge = get_challenge_or_404(slug, True)
        return challenge.polygon

# Add all resources to the RESTful API
api.add_resource(ApiChallengeList, '/api/challenges/')
api.add_resource(ApiChallengeDetail, '/api/challenge/<string:slug>')
api.add_resource(ApiChallengePolygon, '/api/challenge/<string:slug>/polygon')