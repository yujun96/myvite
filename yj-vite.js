



const koa = require('koa')
const app = new koa()
const fs = require('fs')
const path = require('path')
const compilerSFC = require('@vue/compiler-sfc')
const compilerDOM = require("@vue/compiler-dom")

/**
 * @description: 用于替换第三方裸模块
 * @param {*} 需要匹配的内容
 * @return {*} 替换后的内容
 * @author: jun.yu
 */
const replaceModule = (content) => {
  return content.replace(/ from ['"](.*)['"]/g,function(s1,s2){
    if(s2.startsWith('./')||s2.startsWith('/')||s2.startsWith('../')) {
      return s1
    }else {
      return ` from '/@modules/${s2}' `
    }
  })
}
//  处理首页的中间件
app.use(async (ctx,next) => {
  const {url} = ctx 
  //  请求首页
  if(url==='/') {
    const mainPath = path.join(__dirname,'index.html')
    ctx.type="text/html"
    ctx.body = fs.readFileSync(mainPath,'utf8')
  }
  next()
})

//  处理以.js结尾的文件,并且替换vue这种第三方裸模块
app.use(async (ctx,next) => {
  const {url} = ctx 
  if(url.endsWith('.js')) {
    ctx.type="application/javascript"
    const content = fs.readFileSync(path.join(__dirname,url),'utf8')
    // console.log(content)
    ctx.body = replaceModule(content)
  }
  next()
})

// 处理/@module/vue这种情况
app.use(async (ctx,next) => {
  const {url} = ctx 
 if(url.startsWith('/@modules/')) {
  //  我们首先要到node_modles找到这个模块
  // 在这个模块下面找到package.json文件
  // 读取文件下面的module 字段
  // 这里就存放着这个模块的内容
  const moduleName = url.replace('/@modules/', '') // 拿到模块名
  const absoultePath = path.join(__dirname,'node_modules',moduleName)
  const module = require(absoultePath+'/package.json').module // 读取这个文件
  const filePath = path.join(absoultePath,module)
  const result = fs.readFileSync(filePath,'utf8')
  ctx.body=replaceModule(result)
  ctx.type="application/javascript"
 }
  next()
})

//  处理.vue这种文件
//  将.vue文件分为两个部分
// .vue 和.vue?type='template'

app.use(async (ctx,next) => {
  const {url,query} = ctx 
  if(url.indexOf('.vue')>-1) {
  const p = path.join(__dirname,url.split('?')[0])
  const result = compilerSFC.parse(fs.readFileSync(p,'utf8'))
  if(!query.type) {
    const scriptContent = result.descriptor.script.content
    const script = scriptContent.replace('export default ', 'const __script = ')
    ctx.type="application/javascript"
    ctx.body = `
    ${replaceModule(script)}
    import {render as __render} from '${url}?type=template'
    __script.render = __render
    export default __script
    `
  }else if(query.type=='template'){
    const tpl = result.descriptor.template.content
    const render = compilerDOM.compile(tpl,{mode:"module"}).code
  
    ctx.type="application/javascript"
    ctx.body =replaceModule(render)
  }
  }
  
  next()
})




app.listen(3000,()=>{
  console.log("服务启动了: localhost:3000")
})
