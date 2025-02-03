const courseModel = require("../models/courseModel");

const addCourse = async (req, res) => {
    try {
      const newCourse = new courseModel(req.body);
      await newCourse.save();
      res.status(201).json({ message: 'Course created successfully', course: newCourse });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }


  module.exports = {addCourse}