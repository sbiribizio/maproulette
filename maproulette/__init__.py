import os
from flask import Flask
from simplekv.fs import FilesystemStore
from flaskext.kvsession import KVSessionExtension
from flask.ext.sqlalchemy import SQLAlchemy

# initialize server KV session store
if not os.path.exists('./sessiondata'):
    os.makedirs('./sessiondata')
store = FilesystemStore('./sessiondata')

# instantiate flask app
app = Flask(__name__, static_path='/s')

db = SQLAlchemy(app)

from maproulette import config
# This is where you set MapRoulette's configuration mode
# Look at config/__init__.py for configuration classes

app.config.from_object(config.DevelopmentConfig)
# app.config.from_object(config.TestConfig)
# app.config.from_object(config.ProductionConfig)

#from maproulette import models, views, oauth, api
from maproulette import client
app.register_blueprint(client.mod)

from maproulette import api
app.register_blueprint(api.mod)
api.api.init_app(app)

from maproulette.client import oauth
oauth.init_app(app)

# connect flask app to server KV session store
KVSessionExtension(store, app)
