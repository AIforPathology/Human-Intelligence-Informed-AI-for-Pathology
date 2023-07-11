from doc_anno_suite import login_manager
from flask_login import UserMixin
from sqlalchemy import Column, Integer, String, Text
from doc_anno_suite.database import Base
from dataclasses import dataclass
from doc_anno_suite.database import engine

#used for login_manager
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(Base, UserMixin):

    __tablename__ = 'user'
    id = Column(Integer, primary_key=True)
    username = Column(String(20), unique=True, nullable=False)
    email = Column(String(120))
    password = Column(String(60))
    is_admin = Column(Integer)
    assignment = Column(Text)
    anno_index = Column(Integer)
    anno_bbox_index = Column(Integer)
    user_color = Column(String(30))
    log = Column(Text)

    def __repr__(self):
        return f"User('{self.username}')"


class Image(Base):
    __tablename__ = 'image'
    id = Column(Integer, primary_key=True)
    image_id = Column(String(30))
    image_name = Column(String(30), nullable=False)
    image_url = Column(String(200))
    rank = Column(Integer)
    caption_url = Column(String(200))
    paper_url = Column(String(200))
    year = Column(Integer)
    
    def __repr__(self):
        return f"Image('{self.image_name}', '{self.image_id}')"

#https://stackoverflow.com/a/57732785
@dataclass
class Schema(Base):

    id: int
    label_id: str
    label_name: str
    label_type: str
    label_parent: str
    label_abbr: str
    label_isbbox: int
    label_isrequired: int
    label_icon_url: str
    label_placeholder: str

    __tablename__ = 'schema'
    id = Column(Integer, primary_key=True)
    label_id = Column(String(30), nullable=False)
    label_name = Column(String(60))
    label_type = Column(Integer)
    label_parent = Column(String(30))
    label_abbr = Column(String(20))
    label_isbbox = Column(Integer)
    label_isrequired = Column(Integer)
    label_icon_url = Column(String(200))
    label_placeholder = Column(Text)
    label_color = Column(String(30))

    def __repr__(self):
        return f"Schema('{self.label_name}', '{self.label_id}')"


class Annotation(Base):
    '''
    think of optimzing this class using type function
    http://sparrigan.github.io/sql/sqla/2016/01/03/dynamic-tables.html
    '''
    #__table__ = Table('annotation', metadata, autoload=True)
    __tablename__ = 'annotation'
    id = Column(Integer, primary_key=True)
    image_id = Column(String(30))
    username = Column(String(20))
    annotation_log = Column(Text)
    log_dates = Column(Text)
    is_error_image = Column(Integer)
    need_discuss = Column(Integer)
    marked_fun = Column(Integer)
    checked_caption = Column(Integer)
    checked_paper = Column(Integer)
    tracker = Column(Text)




