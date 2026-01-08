const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { auth } = require('../middleware/auth');

// Get current settings
router.get('/', auth, async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            // Create default settings if not exists
            settings = await Settings.create({
                taxRate: 0,
                vatRate: 0,
                serviceFeeRate: 0
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update settings (Root Admin only)
router.put('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'root_admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { taxRate, vatRate, serviceFeeRate } = req.body;

        let settings = await Settings.findOne();
        if (settings) {
            settings.taxRate = taxRate;
            settings.vatRate = vatRate;
            settings.serviceFeeRate = serviceFeeRate;
            settings.updatedBy = req.user._id;
            await settings.save();
        } else {
            settings = await Settings.create({
                taxRate,
                vatRate,
                serviceFeeRate,
                updatedBy: req.user._id
            });
        }

        res.json({ message: 'Settings updated successfully', settings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
