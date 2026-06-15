var express = require('express');
var router = express.Router();

router.get('/error/404', function (req, res) {
    res.render('Error/404')
})

router.get('/error/403', function (req, res) {
    res.render('Error/403')
})

router.get('/error/500', function (req, res) {
    res.render('Error/500')
})

router.get('/error/401', function (req, res) {
    res.render('Error/401')
})

module.exports = router;