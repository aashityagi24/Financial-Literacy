import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { Bell, X, Gift, Megaphone, Trophy, Check, Trash2, ExternalLink, CheckCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const notificationIcons = {
  // Announcements & General
  announcement: { icon: Megaphone, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/dashboard' },
  reward: { icon: Trophy, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/wallet' },
  
  // Gift related
  gift_received: { icon: Gift, color: 'text-[#EE6C4D]', bg: 'bg-[#EE6C4D]/20', path: '/wallet' },
  gift_request: { icon: Gift, color: 'text-[#3D5A80]', bg: 'bg-[#3D5A80]/20', path: null },
  gift_request_declined: { icon: X, color: 'text-[#EE6C4D]', bg: 'bg-[#EE6C4D]/20', path: '/wallet' },
  gift_sent: { icon: Gift, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/wallet' },
  
  // Quest related
  quest: { icon: Trophy, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/quests' },
  quest_created: { icon: Trophy, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/quests' },
  quest_completed: { icon: Check, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/quests' },
  quest_reminder: { icon: Trophy, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/quests' },
  
  // Chore related
  chore: { icon: Trophy, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/quests' },
  chore_created: { icon: Trophy, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/quests' },
  chore_approved: { icon: Check, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/wallet' },
  chore_rejected: { icon: X, color: 'text-[#EE6C4D]', bg: 'bg-[#EE6C4D]/20', path: '/quests' },
  chore_validation: { icon: Check, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/parent-dashboard' },
  chore_reminder: { icon: Trophy, color: 'text-[#FFD23F]', bg: 'bg-[#FFD23F]/20', path: '/quests' },
  
  // Parent Rewards & Penalties
  parent_reward: { icon: Trophy, color: 'text-[#06D6A0]', bg: 'bg-[#06D6A0]/20', path: '/wallet' },
  parent_penalty: { icon: X, color: 'text-[#EE6C4D]', bg: 'bg-[#EE6C4D]/20', path: '/wallet' },
  
  // Investment related
  stock_update: { icon: Trophy, color: 'text-[#10B981]', bg: 'bg-[#10B981]/20', path: '/stock-market' },
  garden_update: { icon: Trophy, color: 'text-[#228B22]', bg: 'bg-[#228B22]/20', path: '/garden' },
  investment_purchase: { icon: Trophy, color: 'text-[#10B981]', bg: 'bg-[#10B981]/20', path: '/wallet' },
  investment_sale: { icon: Trophy, color: 'text-[#10B981]', bg: 'bg-[#10B981]/20', path: '/wallet' },
};

export default function NotificationCenter({ onGiftRequestAction }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnreadOnOpen, setHasUnreadOnOpen] = useState(false);
  const pendingNavigationRef = useRef(null);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await axios.get(`${API}/notifications`);
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };
    
    loadNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle navigation after dialog closes using onOpenChange callback
  const handleDialogChange = (open) => {
    setIsOpen(open);
    if (!open && pendingNavigationRef.current) {
      const path = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      // Small delay to ensure dialog animation completes
      setTimeout(() => navigate(path), 100);
    }
  };

  const handleOpen = () => {
    // Track if there are unread notifications when opening
    setHasUnreadOnOpen(unreadCount > 0 || notifications.some(n => !n.read));
    setIsOpen(true);
  };

  const handleDelete = async (notificationId, e) => {
    if (e) e.stopPropagation();
    try {
      await axios.delete(`${API}/notifications/${notificationId}`);
      setNotifications(notifications.filter(n => n.notification_id !== notificationId));
      toast.success('Notification removed');
    } catch (error) {
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/mark-all-read`);
      // Update local state to mark all as read
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      setHasUnreadOnOpen(false);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    }
  };

  const handleNotificationClick = useCallback((notif) => {
    const typeInfo = notificationIcons[notif.notification_type] || notificationIcons.announcement;
    
    // Don't navigate for gift requests (they have action buttons)
    if (notif.notification_type === 'gift_request') return;
    
    // Get the navigation path - prefer link field if present, then use type mapping
    const path = notif.link || typeInfo.path;
    
    if (path) {
      // Close dialog first, then navigate after a small delay for animation
      setIsOpen(false);
      setTimeout(() => {
        navigate(path);
      }, 150);
    }
  }, [navigate]);

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
      <Dialog open={isOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="bg-white border-3 border-[#1D3557] rounded-3xl max-w-md max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold text-[#1D3557]" style={{ fontFamily: 'Fredoka' }}>
                <Bell className="w-5 h-5 inline mr-2" />
                Notifications
              </DialogTitle>
              {hasUnreadOnOpen && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#06D6A0] hover:bg-[#06D6A0]/10 rounded-lg transition-colors"
                  data-testid="mark-all-read-btn"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
            </div>
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
                  // Clickable if not a gift request AND has either link or path
                  const isClickable = notif.notification_type !== 'gift_request' && (notif.link || typeInfo.path);
                  
                  return (
                    <div 
                      key={notif.notification_id}
                      onClick={() => isClickable && handleNotificationClick(notif)}
                      className={`p-3 rounded-xl border-2 border-[#1D3557]/20 ${typeInfo.bg} ${!notif.read ? 'border-[#1D3557]' : ''} ${
                        isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-white ${typeInfo.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-[#1D3557] text-sm">{notif.title}</p>
                            {isClickable && (
                              <ExternalLink className="w-3 h-3 text-[#3D5A80]/40 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-[#3D5A80] mt-0.5">{notif.message}</p>
                          {notif.from_user_name && (
                            <p className="text-xs text-[#3D5A80]/60 mt-1">From: {notif.from_user_name}</p>
                          )}
                          <p className="text-xs text-[#3D5A80]/60 mt-1">{formatTime(notif.created_at)}</p>
                          
                          {/* Gift Request Actions */}
                          {notif.notification_type === 'gift_request' && notif.related_id && onGiftRequestAction && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onGiftRequestAction(notif.related_id, 'accept');
                                  handleDelete(notif.notification_id, e);
                                }}
                                className="px-3 py-1 bg-[#06D6A0] text-white text-xs font-bold rounded-lg hover:bg-[#05b88a]"
                              >
                                Accept
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onGiftRequestAction(notif.related_id, 'decline');
                                  handleDelete(notif.notification_id, e);
                                }}
                                className="px-3 py-1 bg-[#EE6C4D] text-white text-xs font-bold rounded-lg hover:bg-[#d85a3d]"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDelete(notif.notification_id, e)}
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
