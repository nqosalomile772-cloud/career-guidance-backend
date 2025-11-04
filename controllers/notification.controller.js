const admin = require('firebase-admin');
const { db } = require('../app');

// Get user's notifications
const getUserNotifications = async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
};

// Mark notification as read
const markNotificationRead = async (req, res) => {
    const userId = req.user.uid;
    const { notificationId } = req.params;

    try {
        const notifRef = db.collection('notifications').doc(notificationId);
        const notif = await notifRef.get();

        if (!notif.exists) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (notif.data().userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await notifRef.update({
            read: true,
            readAt: admin.firestore.Timestamp.now()
        });

        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating notification',
            error: error.message
        });
    }
};

// Delete notification
const deleteNotification = async (req, res) => {
    const userId = req.user.uid;
    const { notificationId } = req.params;

    try {
        const notifRef = db.collection('notifications').doc(notificationId);
        const notif = await notifRef.get();

        if (!notif.exists) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (notif.data().userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await notifRef.delete();

        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting notification',
            error: error.message
        });
    }
};

module.exports = {
    getUserNotifications,
    markNotificationRead,
    deleteNotification
};