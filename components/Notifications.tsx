
import React from 'react';
import { Notification, User } from '../types';

interface NotificationDropdownProps {
    notifications: Notification[];
    users: User[];
    onNotificationClick: (n: Notification) => void;
    onMarkAllRead: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ notifications, users, onNotificationClick, onMarkAllRead }) => {
    const getIcon = (type: string) => {
        switch (type) {
            case 'like': return <div className="w-6 h-6 bg-[#EF4444] rounded-full flex items-center justify-center border-2 border-[#0F172A]"><i className="fas fa-heart text-white text-[10px]"></i></div>;
            case 'comment': return <div className="w-6 h-6 bg-[#10B981] rounded-full flex items-center justify-center border-2 border-[#0F172A]"><i className="fas fa-comment-alt text-white text-[10px]"></i></div>;
            case 'follow': return <div className="w-6 h-6 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-[#0F172A]"><i className="fas fa-user-plus text-white text-[10px]"></i></div>;
            case 'birthday': return <div className="w-6 h-6 bg-[#F59E0B] rounded-full flex items-center justify-center border-2 border-[#0F172A]"><i className="fas fa-birthday-cake text-white text-[10px]"></i></div>;
            case 'share': return <div className="w-6 h-6 bg-[#1877F2] rounded-full flex items-center justify-center border-2 border-[#0F172A]"><i className="fas fa-share text-white text-[10px]"></i></div>;
            default: return null;
        }
    };
    const getTimeAgo = (timestamp: string) => {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60) return "Just now";
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };
    return (
        <div className="absolute top-12 right-0 w-[360px] bg-[#0F172A] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-[#1E293B] z-50 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 flex justify-between items-center border-b border-[#1E293B]/60">
                <h3 className="text-[18px] font-bold text-[#F8FAFC]">Notifications</h3>
            </div>
            <div className="px-4 py-2.5 bg-[#0B1120]/50 border-b border-[#1E293B]/40">
                <div className="flex gap-2">
                    <span className="bg-[#1877F2] text-white px-3 py-1 rounded-full text-[13px] font-semibold cursor-pointer shadow-sm">All</span>
                    <span className="hover:bg-[#1E293B] px-3 py-1 rounded-full text-[13px] font-semibold cursor-pointer text-[#94A3B8] hover:text-[#F8FAFC] transition-colors" onClick={onMarkAllRead}>Mark all read</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-[#1E293B]/40">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-[#94A3B8] text-sm">No new notifications</div>
                ) : notifications.map(notif => {
                    const sender = users.find(u => u.id === notif.sender_id);
                    if (!sender) return null;
                    return (
                        <div
                            key={notif.id}
                            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${notif.is_read ? 'hover:bg-[#1E293B]/60 text-[#94A3B8]' : 'bg-[#1E293B]/30 hover:bg-[#1E293B]/60 text-[#F8FAFC]'}`}
                            onClick={() => onNotificationClick(notif)}
                        >
                            <div className="relative flex-shrink-0">
                                <img src={sender.profile_image_url} alt="" className="w-12 h-12 rounded-full object-cover border border-[#1E293B]" />
                                <div className="absolute -bottom-1 -right-1">{getIcon(notif.type)}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] leading-snug text-[#F8FAFC] line-clamp-2">
                                    <span className="font-semibold">{sender.name}</span> {notif.content}
                                </p>
                                <span className={`text-[12px] mt-1 block ${notif.is_read ? 'text-[#94A3B8]' : 'text-[#1877F2] font-medium'}`}>{getTimeAgo(notif.created_at)}</span>
                            </div>
                            {!notif.is_read && (
                                <div className="w-2.5 h-2.5 bg-[#1877F2] rounded-full self-center flex-shrink-0 shadow-[0_0_6px_rgba(24,119,242,0.6)]"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
