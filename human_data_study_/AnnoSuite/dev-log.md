# 12/14

The link to the tool: scholarannosuite.github.io/demo

For now, please use JC and 123 as the account name and password to log in.
All added users through users.csv will have a default password 123.

* add admin page
* differenciate admin account and normal account

cd
cd Downloads
chmod 400 ScholarAnnoSuite.pem
ssh -i "ScholarAnnoSuite.pem" ubuntu@ec2-3-141-103-8.us-east-2.compute.amazonaws.com

nohup python3 run.py > log.txt 2>&1 &


convert database to Json
https://stackoverflow.com/a/57732785
https://stackoverflow.com/a/46180522


icon API:
https://thenounproject.com/

notes:
* the isexclude function doesn't make sense in the comparison interface。如果选择了exclude，那么当前的tag都不会被选到，也就是说无法进行comparison

known bugs:

* recode界面应该采用实时生成的方式实现mouseover的提示，否则速度太慢 (done)
* icon应该使用border的方式来显示是否标注，否则会被遮盖 (done)
* username的union和intersection不对 
* 对于只有一个None的category没有必要显示在recode界面的query panel中 -> set to not null (done)
* annotation 界面的button问题 (done)
* 检查required的提示顺序 (done)
* recode界面进度条 (done)
* 上传下载页面进度条 (done)
* export results & import results (done)
* migrate vis7years的标注结果 (done)
* 没有存储用户的查询记录
* 允许用户自己指定颜色 (user color | localization color) (done)
* sort by similarity
* 对于abbr，如果给定了icon，可以使用任意字符，否则限制为3个 (done)
* consistency icon只出现在第一列 (done)
* 设置:和;为保留符号，不允许出现在free text中，不允许出现在schema中 (done)
* 同一个category中不允许出现同样的name (done)
* 使用label_type = -1来隐藏label (done)
* 在class overview上不显示-1 (done)
* 修正界面上的文本 (done)
* 如果当前的用户没有任何需要标注的内容，需要做异常处理
* 如果文件名中有空格，应该阻止文件
* 如果输入schema的顺序不按照category来，html生成会出问题
* 如何sort by simiarity
* 检查如果没有year，caption等column程序是否正常
* exclude function has errors


Notes in deployment:
* truncate table 在不同数据库中不一样

Other notes:
isFun, isDiscuss, caption, paper都是公有属性，对所有的user保持一致


border shadow: https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow


### AI-Aided Bounding box

AI 生成的结果默认type置为1，如果Human进行了干涉，将其改为0
使用toggle控制隐藏与否


### Questions

* 如何给update project添加二次验证？
我们可以指定form只用于验证当前的文件中是否包含有新的annotation.csv，如果是我们提示用是否需要更新数据，如果是，使用ajax调用更新函数。