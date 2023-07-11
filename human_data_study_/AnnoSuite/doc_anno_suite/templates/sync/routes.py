from os import stat
from flask import Blueprint, url_for
from flask import render_template, flash, redirect, jsonify, make_response, request
from flask_login import login_required, current_user
from doc_anno_suite.annotations.dbutils import AnnotationUtil, DatabaseCRUD
from doc_anno_suite.annotations.utils import ColorUtils, IconUtils
import json
#from tensorpackroot.examples.FasterRCNN.ImageBBoxExtraction import BBoxExtractor #only for AI-mode


annotations = Blueprint('annotations', __name__)


@annotations.route("/annotate")
@login_required
def annotate():
    '''
    1. check if the current annotation table exist
    2. get the latest schema and annotation info
    3. generate the html layout using jinja
    4. fill the content using javascript
    '''
    annotation_util = AnnotationUtil()
    url_image_id = request.args.get('image_id')
    is_ready, msg = annotation_util.check_input_data()
    if(is_ready):
        schemas = DatabaseCRUD.get_label_schemas([-1])
        print(schemas)
        return render_template('annotate.html', title='Annotate', schemas=schemas, username=str(current_user.username), url_image_id=url_image_id)
    else:
        if(current_user.is_admin):
            return redirect(url_for('management.admin'))
        else:
            flash(msg[0], 'danger')
            return render_template('annotate.html', title='Annotate', is_ready=is_ready)

@annotations.route("/annotate_study")
@login_required
def annotate_study():
    '''
    1. check if the current annotation table exist
    2. get the latest schema and annotation info
    3. generate the html layout using jinja
    4. fill the content using javascript
    '''
    annotation_util = AnnotationUtil()
    url_image_id = request.args.get('image_id')
    is_ready, msg = annotation_util.check_input_data()
    if(is_ready):
        schemas = DatabaseCRUD.get_label_schemas([-1])
        category_type_dic = DatabaseCRUD.get_category_type_dic()
        # print(schemas)
        return render_template('annotate-study.html', title='Annotate', category_type_dic=category_type_dic, schemas=schemas, username=str(current_user.username), url_image_id=url_image_id)
    else:
        if(current_user.is_admin):
            return redirect(url_for('management.admin'))
        else:
            flash(msg[0], 'danger')
            return render_template('annotate-study.html', title='Annotate', is_ready=is_ready)

@login_required
@annotations.route("/annotate-bbox")
def annotate_bbox():
    '''
    1. check if the current annotation table exist
    2. get the latest schema and annotation info
    3. generate the html layout using jinja
    4. fill the content using javascript
    '''
    annotation_util = AnnotationUtil()
    url_image_id = request.args.get('image_id')
    is_ready, msg = annotation_util.check_input_data()
    #check if there is bbox labels
    bbox_labels = DatabaseCRUD.get_bbox_label_schemas()
    if(not bbox_labels):
        flash("You haven't set up any localization tasks!", 'danger')
        return render_template('annotate-bbox.html', title='Annotate', is_ready=False)
    if(is_ready):
        schemas = bbox_labels
        return render_template('annotate-bbox.html', title='Annotate', schemas=schemas, username=str(current_user.username), url_image_id=url_image_id)
    else:
        flash(msg[0], 'danger')
        return render_template('annotate-bbox.html', title='Annotate', is_ready=is_ready)

@login_required
@annotations.route("/recode")
def recode():
    annotation_util = AnnotationUtil()
    is_ready, msg = annotation_util.check_input_data()
    if(is_ready):
        schemas = DatabaseCRUD.get_label_schemas()
        schemas = AnnotationUtil.replace_none_labels(schemas)
        users = DatabaseCRUD.get_all_assigned_users()
        years = DatabaseCRUD.get_all_years()
        return render_template('recode.html', title='Re-annotation', schemas=schemas, users=users, years=years, username=str(current_user.username))
    else:
        flash(msg[0], 'danger')
        return render_template('recode.html', title='Re-annotation', is_ready=is_ready)

@login_required
@annotations.route("/overview-bbox")
def overview_bbox():
    annotation_util = AnnotationUtil()
    is_ready, msg = annotation_util.check_input_data()
    if(is_ready):
        schemas = DatabaseCRUD.get_label_schemas()
        schemas = AnnotationUtil.replace_none_labels(schemas)
        users = DatabaseCRUD.get_all_assigned_users()
        years = DatabaseCRUD.get_all_years()
        return render_template('overview-bbox.html', title='Annotation Overview', schemas=schemas, users=users, years=years, username=str(current_user.username))
    else:
        flash(msg[0], 'danger')
        return render_template('recode.html', title='Re-annotation', is_ready=is_ready)

@login_required
@annotations.route("/comparison")
def comparison():
    is_ready, msg = AnnotationUtil.check_input_data()
    if(is_ready):
        schemas = DatabaseCRUD.get_label_schemas()
        schemas = AnnotationUtil.replace_none_labels(schemas)
        users = DatabaseCRUD.get_all_assigned_users()
        years = DatabaseCRUD.get_all_years()
        return render_template('comparison.html', title='Annotation comparison', schemas=schemas, users=users, years=years, username=str(current_user.username))
    else:
        flash(msg[0], 'danger')
        return render_template('comparison.html', title='Annotation comparison', is_ready=is_ready)

# get annotation information


@annotations.route("/get_annotation_info", methods=['GET', 'POST'])
def get_annotation_info():
    if request.method == 'POST':
        '''
        find the annotation info and user info
        @returns username, current_user_assignment, current_user_progress, annotation_query_results
        '''
        request_image_id = request.form.get('image_id')
        if(request_image_id == ''):
            current_username = current_user.username
            current_user_info = DatabaseCRUD.get_user_by_username(
                current_username)
            current_user_progress = int(current_user_info.anno_index)
            current_user_assignment = str(current_user_info.assignment)
            current_user_image_id = current_user_assignment.split(';')[
                current_user_progress]
            current_annotation_info = DatabaseCRUD.get_annotation_by_username_image_id(
                current_username, current_user_image_id)
        else:
            current_username = current_user.username
            current_annotation_info = DatabaseCRUD.get_annotation_by_username_image_id(
                current_username, request_image_id)
            current_user_info = DatabaseCRUD.get_user_by_username(
                current_username)
            current_user_progress = int(current_user_info.anno_index)
            current_user_assignment = str(current_user_info.assignment)
            current_user_image_id = request_image_id
        return {'current_annotation_info': current_annotation_info,
                'current_user_progress': current_user_progress, 'current_user_assignment': current_user_assignment,
                'current_username': current_username, 'current_user_image_id': current_user_image_id}

@annotations.route("/get_bbox_annotation_info", methods=['GET', 'POST'])
def get_bbox_annotation_info():
    if request.method == 'POST':
        '''
        find the annotation info and user info
        @returns username, current_user_assignment, current_user_progress, annotation_query_results
        '''
        request_image_id = request.form.get('image_id')
        if(request_image_id == ''):
            current_username = current_user.username
            current_user_info = DatabaseCRUD.get_user_by_username(
                current_username)
            current_user_progress = int(current_user_info.anno_bbox_index)
            current_user_assignment = str(current_user_info.assignment)
            current_user_image_id = current_user_assignment.split(';')[
                current_user_progress]
            current_annotation_info = DatabaseCRUD.get_annotation_by_username_image_id(
                current_username, current_user_image_id)
        else:
            current_username = current_user.username
            current_annotation_info = DatabaseCRUD.get_annotation_by_username_image_id(
                current_username, request_image_id)
            current_user_info = DatabaseCRUD.get_user_by_username(
                current_username)
            current_user_progress = int(current_user_info.anno_bbox_index)
            current_user_assignment = str(current_user_info.assignment)
            current_user_image_id = request_image_id
        return {'current_annotation_info': current_annotation_info,
                'current_user_progress': current_user_progress, 'current_user_assignment': current_user_assignment,
                'current_username': current_username, 'current_user_image_id': current_user_image_id}


@annotations.route("/update_annotation_log", methods=['POST'])
def update_annotation_log():
    if request.method == 'POST':
        log = request.form.get('log')
        username = request.form.get('username')
        image_id = request.form.get('image_id')
        status = DatabaseCRUD.update_annotation_log(username, image_id, log)
        return {'status': status}


@annotations.route("/update_user_progress", methods=['POST'])
def update_user_progress():
    if request.method == 'POST':
        username = request.form.get('username')
        anno_index = request.form.get('anno_index')
        DatabaseCRUD.update_user_progress(username, anno_index)
        return {'status': 1}

@annotations.route("/update_user_bbox_progress", methods=['POST'])
def update_user_bbox_progress():
    if request.method == 'POST':
        username = request.form.get('username')
        anno_index = request.form.get('anno_index')
        DatabaseCRUD.update_user_bbox_progress(username, anno_index)
        return {'status': 1}


@annotations.route("/update_label_all", methods=['POST'])
def update_label_all():
    '''
    1. update the labels
    2. update the logs
    '''
    if request.method == 'POST':
        username = request.form.get('username')
        image_id = request.form.get('image_id')
        label_id = request.form.get('label_id')
        value = request.form.get('value')
        type = request.form.get('type')
        if(type == 'str'):
            value = str(value)
        elif(type == 'int'):
            value = int(value)
        log = username + ':' + str(label_id) + ':' + str(value)
        status = DatabaseCRUD.update_label_all(
            image_id, label_id, value, type, log)
    return {'status': status}


@annotations.route("/update_label", methods=['POST'])
def update_label():
    '''
    1. update the labels
    2. update the logs
    '''
    if request.method == 'POST':
        username = request.form.get('username')
        image_id = request.form.get('image_id')
        label_id = request.form.get('label_id')
        value = request.form.get('value')
        type = request.form.get('type')
        if(type == 'str'):
            value = str(value)
        elif(type == 'int'):
            value = int(value)
        log = username + ':' + str(label_id) + ':' + str(value)
        status = DatabaseCRUD.update_label(
            username, image_id, label_id, value, type, log)
    return {'status': status}


@annotations.route("/update_tracker_data", methods=['POST'])
def update_tracker_data():
    '''
    update the tracker data
    '''
    if request.method == 'POST':
        username = request.form.get('username')
        image_id = request.form.get('image_id')
        value = request.form.get('value')
        status = DatabaseCRUD.update_tracker_data(username, image_id, value)
    return {'status': status}

@annotations.route("/get_distinct_user_colors", methods=['GET', 'POST'])
def get_distinct_user_colors():
    users = DatabaseCRUD.get_all_assigned_users()
    n = len(users)
    colors = ColorUtils.generate_n_distint_colors(n)
    optional_user_colors = DatabaseCRUD.get_user_colors()
    color_dic = {}
    for i in range(n):
        if optional_user_colors[users[i]] != '':
            color_dic[users[i]] = optional_user_colors[users[i]]
        else:
            color_dic[users[i]] = colors[i]
    return jsonify(color_dic)


@annotations.route("/get_distict_label_colors", methods=['GET', 'POST'])
def get_distict_label_colors():
    '''
    only used for bbox annotation
    '''
    
    schema = DatabaseCRUD.get_bbox_label_schemas_as_dict()
    color_count = 0
    for l in schema:
        if(schema[l]['label_type'] != 0):
            color_count += 1
    colors = ColorUtils.generate_n_distint_colors(color_count)
    index = 0

    for l in schema:
        if(schema[l]['label_type'] != 0):
            if schema[l]['label_color'] == '':
                schema[l]['color'] = colors[index]
                index += 1
            else:
                schema[l]['color'] = schema[l]['label_color']
                index += 1
    return jsonify(schema)


@annotations.route("/get_label_schemas", methods=['GET', 'POST'])
def get_label_schemas():
    # TODO: The label in schema MUST have color attribute when it's type 4 or 5!
    hierarchical_schema = DatabaseCRUD.get_hierarchical_label_schemas()
    schema = DatabaseCRUD.get_label_schemas_as_dict()
    schema_list = DatabaseCRUD.get_label_schemas_as_list()
    return {'hierarchical_schema': hierarchical_schema, 'schema': schema, 'schema_list': schema_list}


@annotations.route("/get_label_icons", methods=['GET', 'POST'])
def get_label_icons():
    icon_dic = IconUtils.get_label_icons()
    return {'icons': icon_dic}


@annotations.route("/query_annotation", methods=['POST'])
def query_annotation():
    '''
    given a query screenshot, return the query results
    1. query the schema data
    2. based on schema data, generate the query string
    let screenshot = {
        'users': currentUsers, done
        'labels': currentLabels, done
        'types': currentTypes, post-processing
        'years': currentYears, :join, done
        'consistencyMode': consistencyMode, post-processing
        'isExclude': isExclude, post-processing
        'isFun': isFun, done
        'isOK': isOK, done
        'isDiscuss': isDiscuss, done
        'sortMode': sortMode: post-processing
    }
    '''
    condition = request.form.get('query_condition')
    condition = json.loads(condition)
    
    users = condition['users']
    labels = condition['labels']
    years = condition['years']
    isFun = int(condition['isFun'])
    isOK = int(condition['isOK'])
    isDiscuss = int(condition['isDiscuss'])
    #if users, labels, years, isFun, isOK, and isDiscuss are empty, remove the where
    if (users == '') and (not labels) and (years == '') and (isFun == 0) and (isOK == 0) and (isDiscuss == 0):
        sql = "SELECT annotation.*, image.image_name, image.caption_url, image.image_url, image.paper_url, image.rank, image.year from image INNER JOIN annotation on image.image_id = annotation.image_id "
    else:
        sql = "SELECT annotation.*, image.image_name, image.caption_url, image.image_url, image.paper_url, image.rank, image.year from image INNER JOIN annotation on image.image_id = annotation.image_id WHERE "
    #users
    if(users != ''):
        sql += '('
        users = users.split(',')
        for i in range(len(users)):
            if(i == 0):
                sql = sql + 'annotation.username = \'' + users[i] + "\'"
            else:
                sql = sql + ' OR annotation.username = \'' + \
                        users[i] + "\'"
        sql += ')'
    # labels
    if not labels:
        pass
    else:
        # print(labels)
        for category in labels:
            sql += ' AND ('
            query_mode = int(labels[category]['queryMode'])
            label_list = labels[category]['labels']
            for i in range(len(label_list)):
                label = label_list[i]
                if(int(label['type']) == 1):
                    if(i == 0):
                        sql = sql + 'annotation.' + label['id'] + " = 1"
                    else:
                        if(query_mode == 1):
                            sql = sql + ' OR ' + 'annotation.' + \
                                label['id'] + " = 1"
                        elif(query_mode == 2):
                            sql = sql + ' AND ' + 'annotation.' + \
                                label['id'] + " = 1"
                elif(int(label['type']) == 2):
                    if(i == 0):
                        sql = sql + 'annotation.' + \
                            label['parent'] + " = \'" + label['id'] + "\'"
                    else:
                        if(query_mode == 1):
                            sql = sql + ' OR ' + 'annotation.' + \
                                label['parent'] + " = \'" + label['id'] + "\'"
                        elif(query_mode == 2):
                            sql = sql + ' AND ' + 'annotation.' + \
                                label['parent'] + " = \'" + label['id'] + "\'"
                elif(int(label['type']) == 3):
                    if(i == 0):
                        sql = sql + 'annotation.' + label['id'] + " != \'\'"
                    else:
                        if(query_mode == 1):
                            sql = sql + ' OR ' + 'annotation.' + \
                                label['id'] + " != \'\'"
                        elif(query_mode == 2):
                            sql = sql + ' AND ' + 'annotation.' + \
                                label['id'] + " != \'\'"

            sql += ')'
    # types: post processing
    # years: for the image table
    if(years != ''):
        sql += ' AND ('
        years = years.split(',')
        for i in range(len(years)):
            if(i == 0):
                sql = sql + 'image.year = \'' + years[i] + "\'"
            else:
                sql = sql + ' OR image.year = \'' + years[i] + "\'"

        sql += ')'
    # isFun
    
    if(isFun == 1):
        sql += ' AND (annotation.marked_fun = 1)'
    # isOK
    
    if(isOK == 1):
        sql += ' AND (annotation.marked_OK = 1)'
    # isDiscuss
    
    if(isDiscuss == 1):
        sql += ' AND (annotation.need_discuss = 1)'
    sql += ' ORDER BY image.rank'

    #print(sql)
    res = DatabaseCRUD.get_annotation_by_query_condition(sql)

    # post-processing
    # type
    if(str(condition['types']) == "" or str(condition['types']) == '0,1'):
        pass
    else:
        res = AnnotationUtil.check_annotation_type(
            res, int(condition['types']))

    # group annotation results
    res = AnnotationUtil.group_annotation_by_imageid(res)

    # filter user by union or intersection
    #print(len(res))
    if int(condition['userQueryMode']) == 2:
        #print("users", users)
        if len(users) > 0:
            res = AnnotationUtil.filter_image_by_users(res, users)

    # #consistency
    consitency_mode = int(condition['consistencyMode'])
    if(consitency_mode == 2):
        pass
    else:
        res = AnnotationUtil.check_consistency(res, consitency_mode)

    # print(res)
    # exclude
    isExclude = int(condition['isExclude'])
    if(isExclude == 1):
        res_all = DatabaseCRUD.get_all_annotations()
        res_all = AnnotationUtil.exclude_operation(res_all, res)
        res = AnnotationUtil.group_annotation_by_imageid(res_all)

    # sort
    sortMode = int(condition['sortMode'])
    if(sortMode == 2):
        res_all = DatabaseCRUD.get_all_annotations()
        res_all = AnnotationUtil.group_annotation_by_imageid(res_all)
        res = AnnotationUtil.sort_res_by_paper(res_all, res)

    return {'res': res}


@annotations.route("/get_predict_bbox", methods=['GET','POST'])
def get_predict_bbox():
    if request.method == 'POST':
        image_url = request.form.get('image_url')
        #bbox_info = BBoxExtractor.get_inference_res(image_url)
        bbox_info = [] #comment this line when using AI-mode
        schema = DatabaseCRUD.get_label_schemas_as_name_dict()
        filter_bbox_info = []
        for bbox in bbox_info:
            if bbox['label'] in schema:
                bbox['label'] = schema[bbox['label']]['label_id']
                filter_bbox_info.append(bbox)
    return {'bbox_info': filter_bbox_info}