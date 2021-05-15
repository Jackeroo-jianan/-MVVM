
//node--当前节点；expr--{{xxx}}中的xxx;vm--当前实例;event--事件*/
const copmileUtil = {
    //通过以下函数，若{{xxx}}为person.name时，也可以得到$data下person.name的值
    getVal(expr,vm){
        return expr.split('.').reduce((data,currentVal)=>{
            //console.log(data,currentVal)
            return data[currentVal]
        },vm.$data)
    },

    //
    setVal(expr,vm,inputVal){
        return expr.split('.').reduce((data,currentVal)=>{
            data[currentVal] = inputVal
        },vm.$data)
    },

    //这个函数是为了{{xx2}}--{{xx1}}这种情况不需要全部重写
    getContentVal(expr,vm){
        return expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            return this.getVal(args[1],vm)
        })
    },

    //v-text:
    text(node,expr,vm){
        let value
        if(expr.indexOf('{{') !== -1){
            value = expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
                new Watcher(vm,args[1],()=>{
                    this.updater.textUpdater(node,this.getContentVal(expr,vm))
                })
                return this.getVal(args[1],vm)
            })
        }else{
             value = this.getVal(expr,vm) 
        }
        
        this.updater.textUpdater(node,value)
    },
    //v-html
    html(node,expr,vm){
        const value = this.getVal(expr,vm) 

        //绑定watcher
        new Watcher(vm,expr,(newVal)=>{
            this.updater.htmlUpdater(node,newVal)
        })

        this.updater.htmlUpdater(node,value)
        
    },
    //v-model
    model(node,expr,vm){
        const value = this.getVal(expr,vm)

        //绑定watcher  数据=>视图
        new Watcher(vm,expr,(newVal)=>{
            this.updater.modelUpdater(node,newVal)
        })

        //视图=>数据=>视图
        node.addEventListener('input',(e)=>{
            this.setVal(expr,vm,e.target.value)
        })

        this.updater.modelUpdater(node,value)

    },
    //绑定函数
    on(node,expr,vm,eventName){
        
        //如果methods中有值，把它赋给fn
        let fn = vm.$options.methods && vm.$options.methods[expr];
        //给节点添加事件监听方法fn,这里已经把fn.bind(vm)已经绑定了当前节点，所以不需要在Vue中再加this
        node.addEventListener(eventName,fn.bind(vm),false)
    },

    
    updater:{
        //text内容更新
        textUpdater(node,value){
            node.textContent = value;
        },
        //html内容更新
        htmlUpdater(node,value){
            node.innerHTML = value;
        },
        //input框内容更新
        modelUpdater(node,value){
            node.value = value;
        },
    }
}

//指令解析器类的定义
class Compile{
    constructor(el,vm){

        //如果el是个元素节点，存到this;否则获取页面中的el存入
        this.el = this.isElementNode(el) ? el : document.querySelector(el)
        //把vm也绑定到this
        this.vm = vm

        //1 将需要添加的元素添加到文档碎片容器中，减少页面回流和重绘
        const fragment = this.node2Fragment(this.el)
        
        //2 编译模板
        this.compile(fragment)

        //3 将文档碎片添加到需要插入的位置
        this.el.appendChild(fragment)
    }


    
    //node2Fragment返回一个文档碎片容器，用于暂时存放创建的dom元素----------
    node2Fragment(el){
        const f = document.createDocumentFragment()
        
        let firstChild
        //console.log(firstChild)
        while (firstChild = el.firstChild){
            f.appendChild(firstChild);
            //console.log(firstChild)
        }
        return f
    }

    //编译节点的执行函数------------------
    compile(fragment){
        //获取所有子节点(元素~，属性~，文本~，注释~，整个文档~)
        const childNodes = fragment.childNodes;
        
        //遍历所有的子节点
        [...childNodes].forEach(child => {
            
            //元素节点进行编译
            if(this.isElementNode(child)){
                this.compileElement(child)
            }      
            //非元素节点进行编译
            else{
                this.compileText(child)
            }
            
            //递归调用，确保每个节点中的节点都被遍历到
            if (child.childNodes && child.childNodes.length){
                this.compile(child)
            }
        });
        

    }

    //对元素节点的编译------------------
    compileElement(node){
        //获取节点属性
        const attributes = node.attributes;
        //console.log(attributes);
        
        //强制存入数组
        [...attributes].forEach(attr => {
            //console.log(attr) //>> v-html="htmlStr" type="text" v-model="msg"
            
            //解构属性
            const {name,value} = attr
            //console.log(name,value) //>>  v-html type v-model

            //判断是否是一个指令：以v-开头
            if (this.isDirective(name)){

                //以'-'进行分割得到directive:如 html on text  on:click
                const [,directive] = name.split('-');

                //再次分割这里主要是为了on:click
                const [dirName,eventName] = directive.split(':');

                //数据驱动视图函数
                copmileUtil[dirName](node,value,this.vm,eventName)
                
                //删除标签上的指令属性
                node.removeAttribute('v-'+ directive)

            }else if(this.isElementNode(name)){
                let [,eventName] = name.split('@')
                //如果是@click类型，直接走到on事件
                copmileUtil['on'](node,value,this.vm,eventName)
            }
        });
    }

    //对非元素节点的编译，即{{xxx}}类型--------------------
    compileText(node){
       
       const content  = node.textContent
       if(/\{\{(.+?)\}\}/.test(content)){
           
           copmileUtil['text'](node,content,this.vm)
       }

    }

    //判断属性是MyVue指令还是自带属性--------------------
    isDirective(attrName){
        return attrName.startsWith('v-')
    }

    //是否是@click写法--------------------
    isElementNode(attrName){
        return attrName.startsWith('@')
    }

    //定义判断是否是元素节点的函数--------------------
    isElementNode(node){
        return node.nodeType === 1
    }
}
                                                  //======================================
class MyVue{
    constructor(options){
       
        //绑定属性,el=>DOM节点;data=>数据
        this.$el = options.el
        this.$data = options.data
        this.$options = options

        if(this.$el){

            //Observer类数据观察者
            new Observer(this.$data)

            //Compile类指令解析器
            new Compile(this.$el,this)

            this.proxyData(this.$data)
        }
    }

    //把this.$data用this代理
    proxyData(data){
        for (const key in dat){
            Object.defineProperties(this,key,{
                get(){
                    return data[key]
                },
                set(newVal){
                    data[key]= newVal;
                }

            })
        }
    }

}

//劫持监听所有属性的类
class Observer{
    constructor(data){
        this.observe(data)
    }

    //定义数据监听函数------------------
    observe(data){
        //监听对象类型数据
        if(data && typeof data === 'object'){

            //遍历最外层的data
            Object.keys(data).forEach(key =>{
                this.defineReactive(data,key,data[key])
            });
        }
    }

    //定义数据数据劫持,参数：1对象 2键 3值--------------------
    defineReactive(obj,key,value){

        //递归遍历
        this.observe(value)

        //创建一个订阅器
        const dep = new Dep();

        //Object.defineProperty()方法会给对象定义一个新属性，或者修改现有属性，并返回这个对象
        //参数 1修改的对象 2定义或修改的属性的名称 3将被定义或修改的属性描述符
        Object.defineProperty(obj,key,{
            enumerable:true,
            configurable:false,

            //获取值，访问该属性时，该方法会被执行，该方法没有参数传入
            get(){
                //订阅数据变化时，向Dep中添加观察者，调用addSub方法添加所有观察者
                Dep.target && dep.addSub(Dep.target)
                return value
            },

            //设置值，属性值修改时，触发执行该方法。该方法将接受唯一参数，即属性的新参数值
            set:(newVal)=>{

                //新的对象也要被监听,set改写为箭头函数确保this指向Observer
                this.observe(newVal)

                if(newVal !== value){
                value = newVal
             }
             //Observer向Dep通知变化
             dep.notify();
        }
    })
}
        
}


//订阅器类；通知watcher要更新，收集watcher
class Dep{
    constructor(){
        //收集依赖
        this.subs = []
    }
    //收集观察者----------------------------
    addSub(watcher){
        this.subs.push(watcher)
    }

    //通知对应的watcher去更新----------------
    notify(){
        //console.log('添加了观察者',this.subs)
        this.subs.forEach(w =>w.update())
    }
}

//观察者的类
class Watcher{
    constructor(vm,expr,callback){
        this.vm = vm
        this.expr = expr
        this.callback = callback

        //原始值
        this.oldVal = this.getOldVal()

    }

    //获取数据原始值--------------------
    getOldVal(){
        //把观察者挂载到Dep上
        Dep.target = this
        const oldVal = copmileUtil.getVal(this.expr,this.vm)
        //删除掉watcher
        Dep.target = this
        return oldVal
    }

    //更新视图，回调给updater(位于compile)-------------------
    update(){
        //获取新的值
        const newVal = copmileUtil.getVal(this.expr,this.vm)
        //新值和原始值不等，新值回调
        if(newVal !== this.oldVal){
            this.callback(newVal)
        }
    }
}