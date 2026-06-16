const debug = require("debug")("ControllerLang");
const ModelLang = require("../model/ModelLang");

module.exports.getLangs = async (req, res) => {
  debug("get Langs")
  const langs = await ModelLang.readAll()
  if(langs){
    res.status(200).json(langs)
  }else{
    res.status(404).json({message: "Could not find any lang"})
  }
}

module.exports.getOneLang = async (req, res) => {
  debug("get one lang")
  const lang = await ModelLang.read(req.params.langCode)
  if(lang){
    res.status(200).json(lang)
  }else{
    res.status(404).json({message: "Could not find lang : "+req.parmas.langCode})
  }
}

