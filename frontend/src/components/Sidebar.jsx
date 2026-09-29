function Sidebar({ activePage, setActivePage }) {
    const menuItems = [
        { id: "dashboard", label: "Dashboard" },
        { id: "chat", label: "Chat" },
        { id: "voice", label: "Voice" },
        { id: "history", label: "History" },
        { id: "knowledge", label: "Knowledge Base" },
        { id: "settings", label: "Settings" },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="brand-mark">L</div>

                <div>
                    <div className="brand-name">LOLO</div>
                    <div className="brand-subtitle">V4 AI SYSTEM</div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`nav-item ${activePage === item.id ? "active" : ""
                            }`}
                        onClick={() => setActivePage(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="connection-indicator">
                    <span className="status-dot"></span>
                    <div>
                        <div className="connection-title">
                            SYSTEM ONLINE
                        </div>
                        <div className="connection-subtitle">
                            Local AI
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;