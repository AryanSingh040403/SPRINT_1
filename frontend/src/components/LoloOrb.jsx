function LoloOrb({ status }) {
    const statusText = {
        idle: "READY",
        thinking: "THINKING",
        listening: "LISTENING",
        speaking: "SPEAKING",
    };

    return (
        <div className={`lolo-state ${status}`}>
            <div className="lolo-orb-large">
                <div className="orb-ring ring-one"></div>
                <div className="orb-ring ring-two"></div>
                <div className="orb-core-large"></div>
            </div>

            <div className="orb-status">
                {statusText[status] || "READY"}
            </div>
        </div>
    );
}

export default LoloOrb;