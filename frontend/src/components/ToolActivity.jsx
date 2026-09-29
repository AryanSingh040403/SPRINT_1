function ToolActivity({ activities }) {
    const getActivityLabel = (activity) => {
        switch (activity.state) {
            case "ready":
                return "SYSTEM READY";

            case "processing":
                return "PROCESSING";

            case "tool":
                return activity.tool
                    ? activity.tool.replace(/_/g, " ").toUpperCase()
                    : "TOOL EXECUTION";

            case "retrieving":
                return "KNOWLEDGE RETRIEVAL";

            case "retrieval_complete":
                return "RAG COMPLETE";

            case "tool_complete":
                return "TOOL COMPLETE";

            case "generating":
                return "LLM GENERATION";

            case "completed":
                return "RESPONSE COMPLETE";

            case "error":
                return "ERROR";

            default:
                return activity.state?.toUpperCase() || "EVENT";
        }
    };

    const getActivityClass = (activity) => {
        if (
            activity.state === "completed" ||
            activity.state === "tool_complete" ||
            activity.state === "retrieval_complete"
        ) {
            return "completed";
        }

        if (
            activity.state === "error"
        ) {
            return "error";
        }

        if (
            activity.state === "processing" ||
            activity.state === "tool" ||
            activity.state === "retrieving" ||
            activity.state === "generating"
        ) {
            return "active";
        }

        return "";
    };

    return (
        <section className="activity-panel">
            <div className="panel-heading">
                AGENT ACTIVITY
            </div>

            <div className="activity-timeline">
                {activities.length === 0 && (
                    <div className="activity-empty">
                        Waiting for a request...
                    </div>
                )}

                {activities.map((activity, index) => (
                    <div
                        key={`${activity.state}-${index}`}
                        className={`activity-event ${getActivityClass(
                            activity
                        )}`}
                    >
                        <div className="timeline-marker">
                            <span className="activity-dot"></span>

                            {index < activities.length - 1 && (
                                <span className="timeline-line"></span>
                            )}
                        </div>

                        <div className="activity-content">
                            <strong>
                                {getActivityLabel(activity)}
                            </strong>

                            <span>
                                {activity.message ||
                                    "Agent event received."}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default ToolActivity;