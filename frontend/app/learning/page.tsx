'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth0Firebase } from '@/hooks/useAuth0Firebase';
import { useGlobeSessions } from '@/hooks/useGlobeSessions';
import { useSessionLinks } from '@/hooks/useSessionLinks';
import { Button } from '@/components/ui/Button';
import { Navbar } from '@/components/ui/Navbar';
import StarryNightBackground from '@/components/ui/starry-night-background';
import { GlobeSessionWithData, deleteSessionLinks } from '@/lib/globe-database';
import { UploadModal } from '@/components/UploadModal';

import { Plus, Star, Globe, X, Trash2, Settings, Link } from 'lucide-react';

interface ConstellationNode {
  id: string;
  session: GlobeSessionWithData;
  position: { x: number; y: number };
  isDragging: boolean;
}

// Constellation Node Component
const ConstellationNode: React.FC<{
  node: ConstellationNode;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick: () => void;
  onDelete: () => void;
  onCreateLink: () => void;
  isSettingsOpen: boolean;
  onToggleSettings: () => void;
  linkCopied: boolean;
  isLinking: boolean;
  isLinkingFrom: boolean;
  isHovered?: boolean;
}> = React.memo(({ node, onMouseDown, onMouseEnter, onMouseLeave, onClick, onDelete, onCreateLink, isSettingsOpen, onToggleSettings, linkCopied, isLinking, isLinkingFrom, isHovered }) => {
  return (
    <div
      data-node-id={node.id}
      className={`absolute select-none ${
        node.isDragging ? 'z-50' : 'z-10'
      } ${isLinking && !isLinkingFrom ? 'cursor-pointer' : ''}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        transform: node.isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: node.isDragging ? 'none' : 'transform 0.1s ease-out',
        willChange: node.isDragging ? 'transform' : 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative group">
        {/* Glow effect */}
        <div className={`absolute inset-0 rounded-xl blur-md transition-all duration-500 ${
          isLinkingFrom 
            ? 'bg-gradient-to-br from-yellow-400/40 to-orange-600/40 group-hover:blur-lg animate-pulse' 
            : isLinking && !isLinkingFrom
            ? 'bg-gradient-to-br from-green-400/30 to-blue-600/30 group-hover:blur-lg group-hover:from-green-400/50 group-hover:to-blue-600/50'
            : isHovered
            ? 'bg-gradient-to-br from-cyan-400/40 to-blue-500/40 blur-lg animate-pulse'
            : 'bg-gradient-to-br from-blue-400/20 to-purple-600/20 group-hover:blur-lg group-hover:from-blue-400/30 group-hover:to-purple-600/30'
        }`} />
        
        {/* Main card container */}
        <div className={`relative backdrop-blur-md border rounded-xl w-48 overflow-hidden transition-all duration-500 ${
          isLinkingFrom
            ? 'bg-yellow-500/10 border-yellow-400/30'
            : isLinking && !isLinkingFrom
            ? 'bg-green-500/10 border-green-400/30 hover:bg-green-500/20'
            : isHovered
            ? 'bg-cyan-500/15 border-cyan-400/40'
            : 'bg-white/5 border-white/10'
        }`}>
          {/* Draggable Handle Bar */}
          <div 
            className="bg-gradient-to-r from-blue-500/40 to-purple-500/40 border-b border-white/10 p-2 hover:from-blue-500/60 hover:to-purple-500/60 transition-colors duration-100"
          >
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center space-x-1 cursor-move flex-1"
                onMouseDown={onMouseDown}
              >
                <div className="w-1.5 h-1.5 bg-white/60 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-white/60 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-white/60 rounded-full"></div>
                <span className="text-xs text-white/70 font-medium ml-2">DRAG</span>
              </div>
              
              {/* Settings/Delete Button */}
              {!isSettingsOpen ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSettings();
                  }}
                  className="p-1 rounded hover:bg-white/20 transition-colors group"
                  title="Settings"
                >
                  <Settings className="w-3 h-3 text-white/60 group-hover:text-white" />
                </button>
              ) : (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="p-1 rounded hover:bg-red-500/30 transition-colors group"
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3 text-white/60 group-hover:text-red-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateLink();
                    }}
                    className="p-1 rounded hover:bg-blue-500/30 transition-colors group"
                    title={linkCopied ? "Link copied!" : "Create shareable link"}
                  >
                    <Link className={`w-3 h-3 transition-colors ${linkCopied ? 'text-green-400' : 'text-white/60 group-hover:text-blue-400'}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSettings();
                    }}
                    className="p-1 rounded hover:bg-white/20 transition-colors group"
                    title="Close settings"
                  >
                    <X className="w-3 h-3 text-white/60 group-hover:text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Clickable content area */}
          <div 
            className="p-4 cursor-pointer hover:bg-white/5 transition-colors duration-100"
            onClick={(e) => {
              if (isLinking) {
                e.stopPropagation();
              }
              onClick();
            }}
          >
            {/* Status indicator */}
            <div className="absolute -top-2 -right-2">
              <div className={`w-4 h-4 rounded-full ${
                node.session.status === 'active' ? 'bg-green-400' : 'bg-blue-400'
              } animate-pulse`} />
            </div>
            
            {/* Globe icon */}
            <div className="flex items-center mb-3">
              <Globe className="w-6 h-6 text-blue-400 mr-2" />
              <span className="text-xs text-white/60 font-medium">
                Globe Session
              </span>
            </div>
            
            {/* Title */}
            <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
              {node.session.title}
            </h3>
            
            {/* Stats */}
            <div className="flex justify-between text-xs text-white/50">
              <span>{node.session.data?.globeImages?.length || 0} images</span>
              <span>{node.session.data?.chatHistory?.length || 0} chats</span>
            </div>
            
            {/* Last accessed */}
            <div className="text-xs text-white/40 mt-2">
              {node.session.lastAccessedAt ? 
                `Last: ${new Date(node.session.lastAccessedAt).toLocaleDateString()}` :
                'Never accessed'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function LearningPage() {
  const router = useRouter();
  const { user, firebaseUserId, isLoading } = useAuth0Firebase();
  const { sessions, loading: sessionsLoading, createNewSession: createSession, deleteSession, updateSessionData, updateSessionDataKey } = useGlobeSessions();
  const { links, createLink, removeLink, getConnectedSessions, reloadLinks, clearAllLinks } = useSessionLinks();
  
  const [nodes, setNodes] = useState<ConstellationNode[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Debug: Log links whenever they change
  useEffect(() => {
    console.log('Current links:', links);
    console.log('Links count:', links.length);
    if (links.length > 0) {
      links.forEach(link => {
        console.log('Link details:', {
          id: link.id,
          from: link.fromSessionId,
          to: link.toSessionId,
          hasFromNode: !!nodes.find(n => n.id === link.fromSessionId),
          hasToNode: !!nodes.find(n => n.id === link.toSessionId)
        });
      });
    }
  }, [links, nodes]);
  const [selectedSession, setSelectedSession] = useState<GlobeSessionWithData | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [settingsOpenNodeId, setSettingsOpenNodeId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    sessionId: string;
    sessionTitle: string;
  }>({ isOpen: false, sessionId: '', sessionTitle: '' });
  const [linkDeleteConfirmation, setLinkDeleteConfirmation] = useState<{
    isOpen: boolean;
    linkId: string;
    fromSessionTitle: string;
    toSessionTitle: string;
  }>({ isOpen: false, linkId: '', fromSessionTitle: '', toSessionTitle: '' });
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);
  
  // State for visual linking
  const [isLinking, setIsLinking] = useState(false);
  const [linkingFromNodeId, setLinkingFromNodeId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [linkingFromPosition, setLinkingFromPosition] = useState({ x: 0, y: 0 });
  
  // State for hover effects on links
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<ConstellationNode[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Prevent overscroll / rubber-band (bounce) effect on touch and wheel when at page top or bottom
  useEffect(() => {
    // Apply CSS overscroll behavior where supported
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = 'none';

    let startY = 0;
    function onTouchStart(e: TouchEvent) {
      if (e.touches && e.touches.length > 0) startY = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (!e.touches || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY; // positive when swiping down

      const scroller = document.scrollingElement || document.documentElement;
      const scrollTop = scroller.scrollTop;
      const scrollHeight = scroller.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      // Prevent scrolling past top
      if (scrollTop === 0 && diff > 0) {
        e.preventDefault();
      }

      // Prevent scrolling past bottom
      if (scrollTop + clientHeight >= scrollHeight && diff < 0) {
        e.preventDefault();
      }
    }

    function onWheel(e: WheelEvent) {
      const deltaY = e.deltaY;
      const scroller = document.scrollingElement || document.documentElement;
      const scrollTop = scroller.scrollTop;
      const scrollHeight = scroller.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      if (deltaY < 0 && scrollTop === 0) {
        e.preventDefault();
      }
      if (deltaY > 0 && scrollTop + clientHeight >= scrollHeight) {
        e.preventDefault();
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false } as AddEventListenerOptions);
    window.addEventListener('wheel', onWheel, { passive: false } as AddEventListenerOptions);

    return () => {
      document.documentElement.style.overscrollBehavior = prevOverscroll || '';
      window.removeEventListener('touchstart', onTouchStart as EventListener);
      window.removeEventListener('touchmove', onTouchMove as EventListener);
      window.removeEventListener('wheel', onWheel as EventListener);
    };
  }, []);

  // Add keyboard event listener for ESC key to cancel linking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLinking) {
        console.log('ESC pressed, canceling link');
        setIsLinking(false);
        setLinkingFromNodeId(null);
        setLinkingFromPosition({ x: 0, y: 0 });
      }
    };

    if (isLinking) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLinking]);

  // Add global click listener to cancel linking mode and deselect links
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isNodeClick = target.closest('[data-node-id]');
      const isSVGClick = target.closest('svg');
      
      if (isLinking && !isNodeClick) {
        console.log('Global click outside nodes, canceling link');
        setIsLinking(false);
        setLinkingFromNodeId(null);
        setLinkingFromPosition({ x: 0, y: 0 });
      }
      
      // Deselect link if clicking outside SVG
      if (!isSVGClick && selectedLinkId) {
        setSelectedLinkId(null);
      }
    };

    document.addEventListener('click', handleGlobalClick, true); // Use capture phase

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [isLinking, selectedLinkId]);

  // Initialize constellation nodes when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0) {
      const initialNodes: ConstellationNode[] = sessions.map((session, index) => ({
        id: session.id,
        session,
        position: {
          x: Math.random() * 800 + 100, // Random position within viewport
          y: Math.random() * 400 + 150,
        },
        isDragging: false,
      }));
      console.log('Creating nodes from sessions:', sessions.map(s => s.id));
      console.log('Node IDs:', initialNodes.map(n => n.id));
      setNodes(initialNodes);
      
      // Reload links after nodes are created to ensure proper rendering
      setTimeout(() => {
        console.log('Reloading links after nodes creation...');
        reloadLinks();
      }, 100);
    } else {
      console.log('No sessions found, clearing nodes');
      setNodes([]);
    }
    
    // Mark initial load as complete after data is loaded
    if (!sessionsLoading && !isLoading) {
      setInitialLoadComplete(true);
    }
  }, [sessions, sessionsLoading, isLoading]); // Removed reloadLinks dependency to prevent infinite loop

  // Drag handlers - optimized for performance
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Close any open settings when starting to drag
    setSettingsOpenNodeId(null);

    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;

    // Store the offset from mouse to node's top-left corner
    setDragOffset({
      x: e.clientX - rect.left - node.position.x,
      y: e.clientY - rect.top - node.position.y,
    });

    setDraggingNodeId(nodeId);
    
    // Only update state for the dragging flag
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, isDragging: true } : n
    ));
  };

  // Throttle mouse move events for better performance
  const throttleRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Always update mouse position for linking mode
    if (isLinking) {
      // For fixed positioning, use clientX/Y directly since it's relative to viewport
      setMousePosition({
        x: e.clientX,
        y: e.clientY
      });
    }

    // Handle dragging if there's a dragging node
    if (!draggingNodeId) return;

    // Calculate new position: current mouse position minus the stored offset
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;

    const constrainedX = Math.max(0, Math.min(newX, rect.width - 200));
    const constrainedY = Math.max(0, Math.min(newY, rect.height - 200));

    // Direct DOM manipulation for immediate response
    const nodeElement = document.querySelector(`[data-node-id="${draggingNodeId}"]`) as HTMLElement;
    if (nodeElement) {
      nodeElement.style.left = `${constrainedX}px`;
      nodeElement.style.top = `${constrainedY}px`;
      nodeElement.style.transform = 'scale(1.02)';
    }

    // Update state immediately for link updates (no throttling)
    setNodes(prev => prev.map(n => 
      n.id === draggingNodeId 
        ? { ...n, position: { x: constrainedX, y: constrainedY } }
        : n
    ));
  };

  const handleMouseUp = () => {
    if (!draggingNodeId) return;

    // Get final position from DOM and update state
    const nodeElement = document.querySelector(`[data-node-id="${draggingNodeId}"]`) as HTMLElement;
    if (nodeElement) {
      const finalX = parseFloat(nodeElement.style.left) || 0;
      const finalY = parseFloat(nodeElement.style.top) || 0;
      
      // Reset transform to normal
      nodeElement.style.transform = 'scale(1)';
      
      setNodes(prev => prev.map(n => 
        n.id === draggingNodeId 
          ? { ...n, position: { x: finalX, y: finalY }, isDragging: false }
          : n
      ));
    }

    setDraggingNodeId(null);
  };



  const openUploadModal = () => {
    console.log('=== OPEN UPLOAD MODAL DEBUG ===');
    console.log('openUploadModal called');
    console.log('Current showUploadModal state:', showUploadModal);
    console.log('User authenticated:', !!user);
    console.log('Firebase user ID:', firebaseUserId);
    console.log('Auth loading state:', isLoading);
    
    if (!user) {
      alert('Please log in to upload images and create sessions');
      return;
    }
    
    if (!firebaseUserId) {
      alert('Authentication is still loading. Please wait a moment and try again.');
      return;
    }
    
    setShowUploadModal(true);
    console.log('Modal should now be open, new state:', true);
  };

  const handleCreateSessionFromUpload = async (title: string) => {
    try {
      console.log('=== CREATE SESSION FROM UPLOAD ===');
      console.log('Creating session with title:', title);
      console.log('User:', user);
      console.log('Firebase User ID:', firebaseUserId);
      console.log('Is Loading:', isLoading);
      
      if (!user) {
        console.error('Cannot create session: User not authenticated');
        alert('Please log in to create a session');
        throw new Error('Please log in to continue');
      }
      
      if (!firebaseUserId) {
        console.error('Cannot create session: No firebase user ID');
        alert('Authentication is still loading. Please wait a moment and try again.');
        throw new Error('Please wait for authentication to complete');
      }
      
      const sessionId = await createSession(title);
      console.log('Successfully created new session with ID:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  };

  // Example functions demonstrating session data communication
  const saveSessionChatHistory = async (sessionId: string, chatHistory: any[]) => {
    try {
      await updateSessionDataKey(sessionId, 'chatHistory', chatHistory);
      console.log('Chat history saved successfully');
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  const saveSessionGlobeImages = async (sessionId: string, globeImages: any[]) => {
    try {
      await updateSessionDataKey(sessionId, 'globeImages', globeImages);
      console.log('Globe images saved successfully');
    } catch (error) {
      console.error('Failed to save globe images:', error);
    }
  };

  const saveCompleteSessionData = async (sessionId: string, data: any) => {
    try {
      await updateSessionData(sessionId, data);
      console.log('Complete session data saved successfully');
    } catch (error) {
      console.error('Failed to save session data:', error);
    }
  };

  // Example: Load session data and use it
  const loadAndUseSessionData = (session: GlobeSessionWithData) => {
    // Data is automatically deserialized from strings to objects
    const chatHistory = session.data.chatHistory || [];
    const globeImages = session.data.globeImages || [];
    const customData = session.data.customData || {};
    
    console.log('Loaded session data:', {
      chatHistory,
      globeImages,
      customData,
      sessionId: session.id
    });
    
    // You can now use this data in your session/components
    return { chatHistory, globeImages, customData };
  };

  const handleToggleSettings = (nodeId: string) => {
    setSettingsOpenNodeId(prev => prev === nodeId ? null : nodeId);
  };

  const handleCreateLink = async (sessionId: string) => {
    // Find the node position to start the visual link from
    const node = nodes.find(n => n.id === sessionId);
    if (!node) return;

    // Get canvas position relative to viewport
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate the center position of the node in viewport coordinates
    const nodePosition = {
      x: rect.left + node.position.x + 100, // Canvas offset + node position + half node width
      y: rect.top + node.position.y + 100   // Canvas offset + node position + half node height
    };

    // Start visual linking mode
    setIsLinking(true);
    setLinkingFromNodeId(sessionId);
    setLinkingFromPosition(nodePosition);
    setMousePosition(nodePosition); // Initialize mouse position to node center
    setSettingsOpenNodeId(null); // Close settings when starting to link
  };

  const handleCompleteLink = async (targetSessionId: string) => {
    if (!isLinking || !linkingFromNodeId || linkingFromNodeId === targetSessionId) return;
    
    console.log('Attempting to create link:', { from: linkingFromNodeId, to: targetSessionId });
    
    try {
      // Create the link in the database (without description)
      const result = await createLink(linkingFromNodeId, targetSessionId, 'related');
      
      console.log('Link creation result:', result);
      
      if (result.success) {
        console.log(`Successfully created link from ${linkingFromNodeId} to ${targetSessionId}`);
        // TODO: Show success toast
      } else {
        console.error('Failed to create link:', result.error);
        if (result.error?.includes('already exists')) {
          console.log('Link already exists - this is normal');
          // TODO: Show info toast that link already exists
        }
      }
    } catch (error) {
      console.error('Error creating link:', error);
    }
    
    // Reset linking mode
    setIsLinking(false);
    setLinkingFromNodeId(null);
    setLinkingFromPosition({ x: 0, y: 0 });
  };

  const handleCancelLink = () => {
    setIsLinking(false);
    setLinkingFromNodeId(null);
    setLinkingFromPosition({ x: 0, y: 0 });
  };

  const handleDeleteLink = async (linkId: string) => {
    // Find the link and get session titles for confirmation
    const link = links.find(l => l.id === linkId);
    if (!link) return;
    
    const fromSession = sessions.find(s => s.id === link.fromSessionId);
    const toSession = sessions.find(s => s.id === link.toSessionId);
    
    if (!fromSession || !toSession) return;
    
    // Show confirmation dialog
    setLinkDeleteConfirmation({
      isOpen: true,
      linkId,
      fromSessionTitle: fromSession.title,
      toSessionTitle: toSession.title
    });
    
    // Clear link selection
    setSelectedLinkId(null);
  };

  const confirmDeleteLink = async () => {
    try {
      const result = await removeLink(linkDeleteConfirmation.linkId);
      if (result.success) {
        console.log('Link deleted successfully');
      } else {
        console.error('Failed to delete link:', result.error);
      }
    } catch (error) {
      console.error('Error deleting link:', error);
    }
    
    // Close confirmation dialog
    setLinkDeleteConfirmation({
      isOpen: false,
      linkId: '',
      fromSessionTitle: '',
      toSessionTitle: ''
    });
  };

  const handleDeleteSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setDeleteConfirmation({
        isOpen: true,
        sessionId,
        sessionTitle: session.title
      });
    }
  };

  const confirmDeleteSession = async () => {
    try {
      // Delete the session and its associated links
      await Promise.all([
        deleteSession(deleteConfirmation.sessionId),
        deleteSessionLinks(deleteConfirmation.sessionId)
      ]);
      
      // Remove from nodes state
      setNodes(prev => prev.filter(node => node.id !== deleteConfirmation.sessionId));
      // Close settings if this node had settings open
      setSettingsOpenNodeId(null);
      // Close confirmation modal
      setDeleteConfirmation({ isOpen: false, sessionId: '', sessionTitle: '' });
    } catch (error) {
      console.error('Failed to delete session:', error);
      // You can add error handling UI here
    }
  };

  const cancelDeleteSession = () => {
    setDeleteConfirmation({ isOpen: false, sessionId: '', sessionTitle: '' });
  };

  // Handle escape key for delete confirmation modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteConfirmation.isOpen) {
        cancelDeleteSession();
      } else if (e.key === 'Escape' && linkDeleteConfirmation.isOpen) {
        setLinkDeleteConfirmation({
          isOpen: false,
          linkId: '',
          fromSessionTitle: '',
          toSessionTitle: ''
        });
      }
    };

    if (deleteConfirmation.isOpen || linkDeleteConfirmation.isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [deleteConfirmation.isOpen, linkDeleteConfirmation.isOpen]);

  const handleCreateNewSession = async () => {
    try {
      console.log('=== HANDLE CREATE NEW SESSION DEBUG ===');
      console.log('Function called');
      console.log('User:', user);
      console.log('Firebase User ID:', firebaseUserId);
      console.log('Auth loading:', isLoading);
      console.log('Create session function type:', typeof createSession);
      
      if (!firebaseUserId) {
        console.error('Cannot create session: No firebase user ID');
        console.log('User object:', user);
        console.log('Loading state:', isLoading);
        alert('Please make sure you are logged in');
        return;
      }
      
      // For now, create with a default title. You can replace this with a modal for user input
      const defaultTitle = `Globe Session ${new Date().toLocaleString()}`;
      console.log('Creating session with title:', defaultTitle);
      
      const sessionId = await createSession(defaultTitle);
      console.log('Successfully created new session with ID:', sessionId);
      console.log('Sessions should refresh automatically via hook');
      
      // The sessions will be automatically refreshed by the useGlobeSessions hook
    } catch (error) {
      console.error('Failed to create session:', error);
      console.error('Error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
      alert('Failed to create session: ' + (error as Error).message);
      // You can add error handling UI here
    }
  };

  const createNewSession = () => {
    setShowUploadModal(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar currentSection={0} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Please log in to explore</h1>
            <p className="text-white/70">You need to be authenticated to access your constellation.</p>
            <div className="mt-4 text-sm text-white/50">
{/*               Debug: User = {user ? 'authenticated' : 'null'}, Loading = {isLoading ? 'true' : 'false'}
 */}            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('=== LEARNING PAGE RENDER DEBUG ===');
  console.log('User:', user);
  console.log('Firebase User ID:', firebaseUserId);
  console.log('Sessions count:', sessions.length);
  console.log('Sessions loading:', sessionsLoading);
  console.log('Auth loading:', isLoading);

  // Show loading screen on initial load or when data is loading
  if (!initialLoadComplete || sessionsLoading || isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar currentSection={0} />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="relative mb-8">
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            </div>
            <h1 className="text-4xl font-bold mb-4">Loading your constellation...</h1>
            <p className="text-white/70">Gathering your globe sessions from the stars.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black text-white overflow-hidden"
      onClick={(e) => {
        // Backup click handler for canceling linking mode
        if (isLinking && e.target === e.currentTarget) {
          console.log('Outer container clicked, canceling link');
          handleCancelLink();
        }
      }}
    >
  <Navbar currentSection={0} variant="learning" />
      
      {/* Constellation Canvas */}
      <div 
        ref={canvasRef}
        className="relative w-full h-screen pt-24"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          console.log('Canvas clicked', e.target, e.currentTarget, e.target === e.currentTarget);
          // Close settings when clicking on empty canvas
          if (e.target === e.currentTarget) {
            setSettingsOpenNodeId(null);
            // Cancel linking mode when clicking on empty space
            if (isLinking) {
              console.log('Canceling link from canvas click');
              handleCancelLink();
            }
          }
        }}
        style={{
          background: 'transparent',
          cursor: isLinking ? 'crosshair' : 'default'
        }}
      >
        {/* Starfield Background */}
        <div 
          className="absolute inset-0 overflow-hidden"
          onClick={(e) => {
            console.log('Starfield clicked');
            if (isLinking) {
              console.log('Canceling link from starfield click');
              setIsLinking(false);
              setLinkingFromNodeId(null);
              setLinkingFromPosition({ x: 0, y: 0 });
            }
            setSettingsOpenNodeId(null);
          }}
        >
          {/* Reusable THREE.js starry background (inlined star generation) */}
          <StarryNightBackground numStars={4500} />
        </div>

        {/* Header */}
        <div className="absolute top-24 left-0 right-0 z-10 text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-white [text-shadow:0_0_20px_#00a3ff]">
            {user?.displayName || user?.email?.split('@')[0] || 'Your'}'s Constellation
          </h1>
          <p className="text-white/60 mb-6">
            Drag your globe sessions around to organize your learning universe
          </p>
        </div>

        {/* Floating Add Button */}
        <Button 
          onClick={openUploadModal}
          className="absolute top-32 right-8 z-20 bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all duration-300"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Session
        </Button>



        {/* Constellation Nodes */}
        {nodes.map((node) => (
          <ConstellationNode
            key={node.id}
            node={node}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => {
              if (isLinking && linkingFromNodeId !== node.id) {
                handleCompleteLink(node.id);
              } else {
                // Clear the store before navigating to ensure fresh state
                const { useChatStore } = require('@/components/useChatStore');
                useChatStore.getState().clear();
                router.push(`/chat/${node.id}`);
              }
            }}
            onDelete={() => handleDeleteSession(node.id)}
            onCreateLink={() => handleCreateLink(node.id)}
            isSettingsOpen={settingsOpenNodeId === node.id}
            onToggleSettings={() => handleToggleSettings(node.id)}
            linkCopied={linkCopiedId === node.id}
            isLinking={isLinking}
            isLinkingFrom={linkingFromNodeId === node.id}
            isHovered={hoveredNodeId === node.id}
          />
        ))}

        {/* Empty State */}
        {sessions.length === 0 && (
          <div 
            className="absolute inset-0 flex items-center justify-center"
            onClick={(e) => {
              console.log('Empty state clicked');
              if (isLinking && e.target === e.currentTarget) {
                console.log('Canceling link from empty state click');
                setIsLinking(false);
                setLinkingFromNodeId(null);
                setLinkingFromPosition({ x: 0, y: 0 });
              }
              setSettingsOpenNodeId(null);
            }}
          >
            <div className="text-center max-w-md"
              onClick={(e) => {
                // Only handle clicks directly on this div, not on child elements like the button
                e.stopPropagation();
              }}
            >
              <div className="mb-6">
                <Star className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Your constellation awaits</h2>
                <p className="text-white/60">
                  Create your first globe session to begin exploring the world and building your learning constellation.
                </p>
              </div>
              <Button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent the empty state click handler from interfering
                  openUploadModal();
                }}
                className="bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all duration-300 relative z-10 pointer-events-auto"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create First Session
              </Button>
            </div>
          </div>
        )}

        {/* Connection Lines between linked nodes */}
        <svg 
          className="absolute inset-0" 
          style={{ 
            zIndex: 1, 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }}
          onClick={(e) => {
            // Only deselect if clicking on the SVG background itself
            if (e.target === e.currentTarget) {
              setSelectedSession(null);
              setSelectedLinkId(null);
              setIsLinking(false);
            }
          }}
        >
          <defs>
            <filter id="linkGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {(() => {
            console.log('=== SVG RENDERING DEBUG ===');
            console.log('Total links to render:', links.length);
            console.log('Total nodes available:', nodes.length);
            console.log('Node IDs:', nodes.map(n => n.id));
            console.log('Link session IDs:', links.map(l => ({ from: l.fromSessionId, to: l.toSessionId })));
            
            // Test if we have any links that should render
            const renderableLinks = links.filter(link => {
              const fromNode = nodes.find(n => n.id === link.fromSessionId);
              const toNode = nodes.find(n => n.id === link.toSessionId);
              return fromNode && toNode;
            });
            console.log('Renderable links count:', renderableLinks.length);
            console.log('Renderable links:', renderableLinks);
            
            return null;
          })()}
          {links.map((link) => {
            console.log('Processing link:', link.id);
            const fromNode = nodes.find(n => n.id === link.fromSessionId);
            const toNode = nodes.find(n => n.id === link.toSessionId);
            
            console.log('Node lookup result:', { 
              linkId: link.id,
              fromSessionId: link.fromSessionId, 
              toSessionId: link.toSessionId,
              fromNodeFound: !!fromNode, 
              toNodeFound: !!toNode,
              fromNodeId: fromNode?.id,
              toNodeId: toNode?.id
            });
            
            if (!fromNode || !toNode) {
              console.log('❌ SKIPPING LINK - Missing node(s):', { 
                linkId: link.id,
                missingFrom: !fromNode, 
                missingTo: !toNode,
                availableNodeIds: nodes.map(n => n.id)
              });
              return null;
            }
            
            console.log('✅ RENDERING LINK:', link.id);
            
            // Check if either connected node is being hovered OR if the link itself is hovered
            const isConnectedToHover = hoveredNodeId === link.fromSessionId || hoveredNodeId === link.toSessionId;
            const isLinkHovered = hoveredLinkId === link.id;
            const isLinkSelected = selectedLinkId === link.id;
            const shouldGlow = isConnectedToHover || isLinkHovered || isLinkSelected;
            
            return (
              <g key={link.id}>
                {/* Invisible larger hitbox for easier clicking */}
                <line
                  x1={fromNode.position.x + 100}
                  y1={fromNode.position.y + 100}
                  x2={toNode.position.x + 100}
                  y2={toNode.position.y + 100}
                  stroke="transparent"
                  strokeWidth="20"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredLinkId(link.id)}
                  onMouseLeave={() => setHoveredLinkId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLinkId(selectedLinkId === link.id ? null : link.id);
                  }}
                />
                {/* Glow effect layer - changes color on hover with smooth transition */}
                <line
                  x1={fromNode.position.x + 100}
                  y1={fromNode.position.y + 100}
                  x2={toNode.position.x + 100}
                  y2={toNode.position.y + 100}
                  stroke={shouldGlow ? "rgba(100, 200, 255, 0.8)" : "rgba(255, 255, 255, 0.3)"}
                  strokeWidth={shouldGlow ? "12" : "8"}
                  filter="url(#linkGlow)"
                  className={shouldGlow ? "animate-pulse" : ""}
                  style={{
                    transition: 'stroke 0.3s ease-in-out, stroke-width 0.3s ease-in-out',
                    pointerEvents: 'none'
                  }}
                />
                {/* Main solid line - brightens on hover with smooth transition */}
                <line
                  x1={fromNode.position.x + 100}
                  y1={fromNode.position.y + 100}
                  x2={toNode.position.x + 100}
                  y2={toNode.position.y + 100}
                  stroke={shouldGlow ? "rgba(150, 220, 255, 1)" : "rgba(255, 255, 255, 0.7)"}
                  strokeWidth={shouldGlow ? "4" : "2"}
                  filter="url(#linkGlow)"
                  style={{
                    transition: 'stroke 0.3s ease-in-out, stroke-width 0.3s ease-in-out',
                    pointerEvents: 'none'
                  }}
                />
                {/* Connection indicator - grows and changes color on hover with smooth transition */}
                <circle
                  cx={fromNode.position.x + (toNode.position.x - fromNode.position.x) * 0.5 + 100}
                  cy={fromNode.position.y + (toNode.position.y - fromNode.position.y) * 0.5 + 100}
                  r={shouldGlow ? "6" : "3"}
                  fill={shouldGlow ? "rgba(100, 200, 255, 1)" : "rgba(255, 255, 255, 0.6)"}
                  filter="url(#linkGlow)"
                  className="animate-pulse"
                  style={{
                    transition: 'fill 0.3s ease-in-out, r 0.3s ease-in-out',
                    pointerEvents: 'none'
                  }}
                />
                {/* Delete button when link is selected */}
                {isLinkSelected && (
                  <g>
                    {/* Purple gradient definitions */}
                    <defs>
                      <linearGradient id={`deleteGradient-${link.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(96, 165, 250, 0.4)" />
                        <stop offset="100%" stopColor="rgba(147, 51, 234, 0.4)" />
                      </linearGradient>
                    </defs>

                    {/* Purple gradient background - same size as session button */}
                    <rect
                      x={fromNode.position.x + (toNode.position.x - fromNode.position.x) * 0.5 + 100 - 10}
                      y={fromNode.position.y + (toNode.position.y - fromNode.position.y) * 0.5 + 100 - 25}
                      width="20"
                      height="20"
                      rx="4"
                      fill={`url(#deleteGradient-${link.id})`}
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="1"
                      filter="url(#linkGlow)"
                      style={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onMouseEnter={(e) => {
                        // Add red hover overlay
                        e.currentTarget.setAttribute('fill', 'rgba(239, 68, 68, 0.6)');
                        e.currentTarget.setAttribute('stroke', 'rgba(255, 255, 255, 0.4)');
                        // Change icon color to red
                        const icon = e.currentTarget.parentNode?.querySelector('.trash-icon');
                        if (icon) icon.setAttribute('stroke', 'rgba(248, 113, 113, 1)');
                      }}
                      onMouseLeave={(e) => {
                        // Reset to purple gradient
                        e.currentTarget.setAttribute('fill', `url(#deleteGradient-${link.id})`);
                        e.currentTarget.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
                        // Reset icon color
                        const icon = e.currentTarget.parentNode?.querySelector('.trash-icon');
                        if (icon) icon.setAttribute('stroke', 'rgba(255, 255, 255, 0.6)');
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLink(link.id);
                      }}
                    />

                    {/* Trash icon - exact same size as session (w-3 h-3 = 12px) */}
                    <g
                      className="trash-icon"
                      transform={`translate(${fromNode.position.x + (toNode.position.x - fromNode.position.x) * 0.5 + 100 - 6}, ${fromNode.position.y + (toNode.position.y - fromNode.position.y) * 0.5 + 100 - 21})`}
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.6)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ 
                        pointerEvents: 'none',
                        transition: 'stroke 0.2s ease-in-out'
                      }}
                    >
                      {/* Trash2 icon scaled to 12px (w-3 h-3) */}
                      <path d="M3 6h18" transform="scale(0.5)" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" transform="scale(0.5)" />
                      <path d="m19 6-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" transform="scale(0.5)" />
                      <path d="m10 11 0 4" transform="scale(0.5)" />
                      <path d="m14 11 0 4" transform="scale(0.5)" />
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Visual Linking Thread */}
      {isLinking && (
        <svg className="fixed inset-0 pointer-events-none" style={{ zIndex: 999999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {/* Main linking line */}
          <line
            x1={linkingFromPosition.x}
            y1={linkingFromPosition.y}
            x2={mousePosition.x}
            y2={mousePosition.y}
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="3"
            filter="url(#glow)"
            className="animate-pulse"
          />
          {/* Sparkle effects along the line */}
          <circle
            cx={linkingFromPosition.x + (mousePosition.x - linkingFromPosition.x) * 0.3}
            cy={linkingFromPosition.y + (mousePosition.y - linkingFromPosition.y) * 0.3}
            r="2"
            fill="rgba(255, 255, 255, 0.8)"
            filter="url(#glow)"
            className="animate-ping"
          />
          <circle
            cx={linkingFromPosition.x + (mousePosition.x - linkingFromPosition.x) * 0.7}
            cy={linkingFromPosition.y + (mousePosition.y - linkingFromPosition.y) * 0.7}
            r="1.5"
            fill="rgba(255, 255, 255, 0.6)"
            filter="url(#glow)"
            className="animate-pulse"
          />
        </svg>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal 
          session={selectedSession} 
          onClose={() => setSelectedSession(null)} 
        />
      )}

      {/* Upload Modal for New Session */}
      <UploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onCreateSession={handleCreateSessionFromUpload}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelDeleteSession();
            }
          }}
        >
          <div className="bg-gray-900/95 backdrop-blur-md border border-red-500/30 rounded-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-6">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              
              {/* Title */}
              <h3 className="text-2xl font-bold text-white mb-3">
                Delete Session
              </h3>
              
              {/* Warning Message */}
              <p className="text-white/70 mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-white font-semibold mb-6 break-words">
                "{deleteConfirmation.sessionTitle}"?
              </p>
              
              <p className="text-red-400/80 text-sm mb-8">
                This action cannot be undone. All your globe images and chat history will be permanently lost.
              </p>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={cancelDeleteSession}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteSession}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                >
                  Delete Forever
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Delete Confirmation Modal */}
      {linkDeleteConfirmation.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLinkDeleteConfirmation({
                isOpen: false,
                linkId: '',
                fromSessionTitle: '',
                toSessionTitle: ''
              });
            }
          }}
        >
          <div className="bg-gray-900/95 backdrop-blur-md border border-red-500/30 rounded-2xl p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-6">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              
              {/* Title */}
              <h3 className="text-2xl font-bold text-white mb-3">
                Delete Connection
              </h3>
              
              {/* Warning Message */}
              <p className="text-white/70 mb-2">
                Are you sure you want to delete the link between
              </p>
              <p className="text-white font-semibold mb-2 break-words">
                "{linkDeleteConfirmation.fromSessionTitle}"
              </p>
              <p className="text-white/70 mb-2">and</p>
              <p className="text-white font-semibold mb-6 break-words">
                "{linkDeleteConfirmation.toSessionTitle}"?
              </p>
              
              <p className="text-red-400/80 text-sm mb-8">
                This will remove the connection between these sessions. This action cannot be undone.
              </p>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setLinkDeleteConfirmation({
                    isOpen: false,
                    linkId: '',
                    fromSessionTitle: '',
                    toSessionTitle: ''
                  })}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteLink}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                >
                  Delete Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, onSelect }: { session: GlobeSessionWithData; onSelect: () => void }) {
  return (
    <div 
      onClick={onSelect}
      className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20 hover:border-white/40 cursor-pointer transition-all duration-300 hover:bg-white/15"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-white">{session.title}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          session.status === 'active' 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {session.status}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center text-white/70 text-sm">
          <span>📍 {session.data?.globeImages?.length || 0} locations explored</span>
        </div>
        <div className="flex items-center text-white/70 text-sm">
          <span>💬 {session.data?.chatHistory?.length || 0} AI conversations</span>
        </div>
        <div className="flex items-center text-white/70 text-sm">
          <span>🕒 Last accessed: {session.lastAccessedAt.toLocaleDateString()}</span>
        </div>
      </div>

      {/* Preview of latest globe image */}
      {session.data?.globeImages?.length > 0 && (
        <div className="mb-4">
          <div className="w-full h-32 bg-gray-800 rounded-lg flex items-center justify-center text-white/50">
            Globe View Preview
            <br />
            <span className="text-xs">{session.data?.globeImages?.[session.data.globeImages.length - 1]?.locationName}</span>
          </div>
        </div>
      )}

      <Button 
        className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        Continue Exploring
      </Button>
    </div>
  );
}

function SessionDetailModal({ session, onClose }: { session: GlobeSessionWithData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-white/20 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{session.title}</h2>
          <Button 
            onClick={onClose}
            variant="outline" 
            className="border-white/30 text-white hover:bg-white/20"
          >
            Close
          </Button>
        </div>
        
        <div className="grid md:grid-cols-2 h-[70vh]">
          {/* Globe Images */}
          <div className="p-6 border-r border-white/20 overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Globe Exploration</h3>
            <div className="space-y-4">
              {session.data?.globeImages?.map((image: any) => (
                <div key={image.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="w-full h-40 bg-gray-800 rounded-lg mb-3 flex items-center justify-center text-white/50">
                    Globe Screenshot
                    <br />
                    {image.locationName}
                  </div>
                  <div className="text-white/80 text-sm">
                    <p className="font-medium">{image.locationName}</p>
                    <p className="text-white/60">
                      {image.location.lat.toFixed(4)}, {image.location.lng.toFixed(4)}
                    </p>
                    {image.userNote && (
                      <p className="text-white/70 mt-2 italic">"{image.userNote}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Chat History */}
          <div className="p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">AI Conversation</h3>
            <div className="space-y-3">
              {session.data?.chatHistory?.map((chat: any) => (
                <div key={chat.id} className={`p-3 rounded-lg ${
                  chat.role === 'user' 
                    ? 'bg-blue-500/20 ml-8 text-blue-100' 
                    : 'bg-white/10 mr-8 text-white'
                }`}>
                  <div className="text-sm font-medium mb-1">
                    {chat.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  <div className="text-sm">{chat.message}</div>
                  <div className="text-xs text-white/50 mt-2">
                    {chat.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

