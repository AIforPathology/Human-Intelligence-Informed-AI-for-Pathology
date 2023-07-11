
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
from doc_anno_suite.database import db_session
from doc_anno_suite.config import Config
from doc_anno_suite.database import init_db
from flask_socketio import SocketIO

bcrypt = Bcrypt()
login_manager = LoginManager()
login_manager.login_view = 'users.login'
login_manager.login_message_category = 'info'

def create_app(config_class=Config):

    init_db()

    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['UPLOAD_FOLDER'] = app.root_path + '/static/upload_files/'  
    app.config['BACKUP_FOLDER'] = app.root_path + '/backups/'  
    app.config['ICON_FOLDER'] = app.root_path + '/static/images/icons/'  
    app.config['LABEL_ICON_FOLDER'] = app.root_path + '/static/images/label_icons/'  

    bcrypt.init_app(app)
    login_manager.init_app(app)

    from doc_anno_suite.users.routes import users
    from doc_anno_suite.management.routes import management
    from doc_anno_suite.annotations.routes import annotations
    from doc_anno_suite.main.routes import main

    app.register_blueprint(users)
    app.register_blueprint(management)
    app.register_blueprint(annotations)
    app.register_blueprint(main)

    '''
    The following codes are used for creating socketio to support eyetracker communication
    References:
    https://blog.miguelgrinberg.com/post/easy-websockets-with-flask-and-gevent
    https://flask-socketio.readthedocs.io/en/latest/getting_started.html#initialization
    https://stackoverflow.com/questions/59256718/send-data-continuously-from-flask-api-to-javascript-frontend
    '''
    socketio = SocketIO(app)

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db_session.remove()

    return app, socketio


