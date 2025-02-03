const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");

router.post('/add-course',contentController.addCourse);



module.exports =  router;