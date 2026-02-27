/**
 * Content Protection Component
 * Implements various measures to prevent casual copying/downloading of content
 * Note: These measures deter casual users but cannot stop determined technical users
 */

import { useEffect } from 'react';

export default function ContentProtection() {
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // Block keyboard shortcuts for copying, viewing source, saving, printing, dev tools
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + Shift + I (Dev Tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + Shift + J (Console)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + Shift + C (Inspect Element)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }
      // F12 (Dev Tools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      // Ctrl/Cmd + A (Select All) - optional, can be annoying
      // if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      //   e.preventDefault();
      //   return false;
      // }
    };

    // Disable text selection via JS (backup for CSS)
    const handleSelectStart = (e) => {
      // Allow selection in input fields and textareas
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable drag and drop
    const handleDragStart = (e) => {
      e.preventDefault();
      return false;
    };

    // Disable copy (except in input fields)
    const handleCopy = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable cut
    const handleCut = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
    };
  }, []);

  return null; // This component doesn't render anything
}
