import React, { useRef, useEffect } from 'react';
import { MEGA_MENU_CONFIG } from '../../routes/routes.config';
import type { MegaMenuModule } from '../../routes/routes.config';
import { useNavigationStore } from '../../store/navigationStore';
import { useNavigate } from 'react-router-dom';
import { EnterprisePlatformSDK } from '../../sdk/EnterprisePlatformSDK';
import * as Icons from 'lucide-react';
import { ArrowRight, Star, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface MegaMenuProps {
  moduleId: string;
  onClose: () => void;
}

export function MegaMenu({ moduleId, onClose }: MegaMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const favorites = useNavigationStore(state => state.favorites);
  const toggleFavorite = useNavigationStore(state => state.toggleFavorite);

  // Merge static categories with dynamically registered plugins
  const allModules: MegaMenuModule[] = [...MEGA_MENU_CONFIG];
  
  const registeredPlugins = EnterprisePlatformSDK.getPlugins();
  registeredPlugins.forEach(p => {
    if (!allModules.some(m => m.id === p.key)) {
      allModules.push({
        id: p.key,
        title: p.key.replace('_', ' ').toUpperCase(),
        icon: p.key === 'procurement' ? 'ShoppingBag' : p.key === 'inventory' ? 'Boxes' : p.key === 'finance' ? 'Landmark' : 'Layers',
        roles: [],
        categories: p.megaMenu?.map(mm => ({
          title: mm.cardTitle,
          cards: [{
            title: mm.cardTitle,
            icon: mm.cardIcon,
            description: mm.cardDescription,
            links: mm.links
          }]
        }))
      });
    }
  });

  const mod = allModules.find(m => m.id === moduleId);

  // Close menu on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!mod || !mod.categories || mod.categories.length === 0) return null;

  const handleLinkClick = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleFavoriteClick = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    toggleFavorite(path);
    toast.success(favorites.includes(path) ? 'Removed from favorites.' : 'Pinned to favorites.');
  };

  // Mock pending counts for demo metrics (e.g. POs Pending = 12)
  const getPendingCount = (badgeKey?: string) => {
    if (badgeKey === 'pendingApprovals') return 12;
    return null;
  };

  // Mock recent files for demonstration
  const getRecentItems = (title: string) => {
    if (title.includes('Purchase Orders')) {
      return ['PO-2026-001', 'PO-2026-002'];
    }
    return [];
  };

  return (
    <div
      ref={menuRef}
      onMouseLeave={onClose}
      className="absolute top-16 left-0 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xl z-50 p-6 sm:p-8 animate-slide-down font-sans"
    >
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {mod.categories.map((cat, catIdx) => (
          <div key={catIdx} className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              {cat.title}
            </h3>
            
            <div className="space-y-4">
              {cat.cards.map((card, cardIdx) => {
                const CardIcon = (Icons as any)[card.icon] || Icons.Circle;
                const pendingCount = getPendingCount(card.pendingBadgeKey);
                const recents = getRecentItems(card.title);

                return (
                  <div 
                    key={cardIdx} 
                    className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-slate-200/80 rounded-2xl transition-all duration-200 space-y-3 relative group"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg shadow-sm">
                          <CardIcon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 tracking-wide uppercase">{card.title}</h4>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5 line-clamp-1">{card.description}</p>
                        </div>
                      </div>
                      
                      {pendingCount !== null && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded-lg animate-pulse">
                          {pendingCount} Pending
                        </span>
                      )}
                    </div>

                    {/* Quick Links List */}
                    <div className="space-y-1">
                      {card.links.map((link, linkIdx) => {
                        const isFav = favorites.includes(link.path);
                        return (
                          <div
                            key={linkIdx}
                            onClick={() => handleLinkClick(link.path)}
                            className="flex items-center justify-between text-xs font-semibold py-1 px-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-blue-600 transition-all cursor-pointer group/link"
                          >
                            <span className="flex items-center gap-1.5">
                              <ArrowRight className="w-3 h-3 text-slate-300 group-hover/link:text-blue-500 transition-colors" />
                              {link.label}
                            </span>
                            
                            <div className="flex items-center gap-1">
                              {link.shortcut && (
                                <kbd className="text-[8px] font-mono text-slate-400 border border-slate-200 bg-slate-50 px-1 rounded">
                                  {link.shortcut}
                                </kbd>
                              )}
                              <button
                                onClick={(e) => handleFavoriteClick(e, link.path)}
                                className={`p-0.5 rounded opacity-0 group-hover/link:opacity-100 transition-opacity hover:bg-slate-100 ${
                                  isFav ? 'text-amber-500 opacity-100' : 'text-slate-400 hover:text-amber-500'
                                }`}
                                title={isFav ? 'Remove Favorite' : 'Save Favorite'}
                              >
                                <Star className="w-3 h-3 fill-current" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Recents list if available */}
                    {recents.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <Clock className="w-2.5 h-2.5 text-slate-300" />
                        <span>Recent: {recents.join(', ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
