import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import EmptyState from "../components/ui/EmptyState";

export default function NotFoundPage() {
  return (
    <div>
      <EmptyState icon={Compass} title="Page not found" description="That route doesn't exist." />
      <div className="text-center -mt-16">
        <Link to="/" className="text-sm font-medium text-indigo">
          Back to Explore
        </Link>
      </div>
    </div>
  );
}
