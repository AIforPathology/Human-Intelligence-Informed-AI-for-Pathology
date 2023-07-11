from flask import render_template, url_for, flash, redirect, Blueprint
from doc_anno_suite.users.forms import RegistrationForm, LoginForm
from doc_anno_suite.models import User
from doc_anno_suite import bcrypt
from doc_anno_suite.database import db_session
from flask_login import login_user, current_user, logout_user

users = Blueprint('users', __name__)

@users.route("/register", methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('management.admin'))
    user = User.query.filter_by(is_admin = 1).first()
    if(user):
        flash('Registration is now closed.', 'danger')
        return redirect(url_for('management.admin'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        hashed_password = bcrypt.generate_password_hash(
            form.password.data).decode('utf-8')
        user = User(username=form.username.data, email=form.email.data,
                    password=hashed_password, is_admin=1, anno_index = 0, anno_bbox_index = 0)
        db_session.add(user)
        db_session.commit()
        # flash message
        flash('Your account has been created!', 'success')
        return redirect(url_for('users.login'))
    return render_template('register.html', title='Register', form=form)


@users.route("/", methods=['GET', 'POST'])
@users.route("/login", methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('annotations.annotate_study'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and bcrypt.check_password_hash(user.password, form.password.data):
            current_user.is_admin = user.is_admin
            login_user(user, remember=form.remember.data)
            return redirect(url_for('annotations.annotate_study'))
        else:
            flash('Login Unsuccessful. Please check username and password', 'danger')
    return render_template('login.html', title='Login', form=form)


@users.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('users.login'))