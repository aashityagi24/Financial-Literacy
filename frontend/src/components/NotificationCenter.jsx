import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Bell, X, Gift, Megaphone, Trophy, Check, Trash2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const notificationIcons = {
  announcement: { icon: Megaphone, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/dashboard' },
  reward: { icon: Trophy, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/wallet' },
  gift_received: { icon: Gift, color: 'text-[#EE6C4D]', bg: 'bg-[#EE6C4D]/20', path: '/wallet' },
  gift_request: { icon: Gift, color: 'text-[#3D5A80]', bg: 'bg-[#3D5A80]/20', path: null },
  gift_request_declined: { icon: X, color: 'text-[#EE6C4D]', bg: 'bg-[#EE6C4D]/20', path: '/wallet' },
  quest_created: { icon: Trophy, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/quests' },
  quest_completed: { icon: Check, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/quests' },
  chore_created: { icon: Trophy, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/quests' },
  chore_approved: { icon: Check, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/wallet' },
  chore_rejected: { icon: X, color: 'text-[#EE6C4D]', bg: 'bg-[#EE6C4D]/20', path: '/quests' },
  stock_update: { icon: Trophy, color: 'text-[#10B981]', bg: 'bg-[#10B981]/20', path: '/stock-market' },
  garden_update: { icon: Trophy, color: 'text-[#228B22]', bg: 'bg-[#228B22]/20', path: '/garden' },
};

export default function NotificationCenter({ onGiftRequestAction }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/notifications`);
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleOpen = async () => {
    setIsOpen(true);
    if (unreadCount > 0) {
      try {
        await axios.post(`${API}/notifications/mark-read`);
        setUnreadCount(0);
        setNotifications(notifications.map(n => ({ ...n, read: true })));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await axios.delete(`${API}/notifications/${notificationId}`);
      setNotifications(notifications.filter(n => n.notification_id !== notificationId));
      toast.success('Notification removed');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {/* Notification Bell */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl border-2 border-[#1D3557] bg-white hover:bg-[#E0FBFC] transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-[#1D3557]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EE6C4D] text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
              <Bell className="w-5 h-5 inline mr-2" />
              Notifications
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 mx-auto text-[#98C1D9] mb-2" />
                <p className="text-[#3D5A80]">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {notifications.map((notif) => {
                  const typeInfo = notificationIcons[notif.notification_type] || notificationIcons.announcement;
                  const IconComponent = typeInfo.icon;
                  
                  return (
                    <div 
                      key={notif.notification_id}
                      className={`p-3 rounded-xl border-2 border-[#1D3557]/20 ${typeInfo.bg} ${!notif.read ? 'border-[#1D3557]' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white ${typeInfo.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#1D3557] text-sm">{notif.title}</p>
                          <p className="text-xs text-[#3D5A80] mt-0.5">{notif.message}</p>
                          {notif.from_user_name && (
                            <p className="text-xs text-[#3D5A80]/60 mt-1">From: {notif.from_user_name}</p>
                          )}
                          <p className="text-xs text-[#3D5A80]/60 mt-1">{formatTime(notif.created_at)}</p>
                          
                          {/* Gift Request Actions */}
                          {notif.notification_type === 'gift_request' && notif.related_id && onGiftRequestAction && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => {
                                  onGiftRequestAction(notif.related_id, 'accept');
                                  handleDelete(notif.notification_id);
                                }}
                                className="px-3 py-1 bg-[#06D6A0] text-white text-xs font-bold rounded-lg hover:bg-[#05b88a]"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => {
                                  onGiftRequestAction(notif.related_id, 'decline');
                                  handleDelete(notif.notification_id);
                                }}
                                className="px-3 py-1 bg-[#EE6C4D] text-white text-xs font-bold rounded-lg hover:bg-[#d85a3d]"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(notif.notification_id)}
                          className="p-1 hover:bg-white/50 rounded text-[#3D5A80]/60 hover:text-[#EE6C4D]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
