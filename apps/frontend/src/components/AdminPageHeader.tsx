import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

interface AdminPageHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  onBack?: () => void;
  action?: React.ReactNode;
}

const AdminPageHeader = ({ title, description, icon: Icon, onBack, action }: AdminPageHeaderProps) => (
  <div className="glass-card overflow-hidden rounded-sm border border-sidebar-border bg-card/60 animate-fade-in mb-3">
    <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
      <div className="flex items-center gap-4 min-w-0">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-foreground/70 hover:bg-primary/10 hover:text-primary transition-all duration-300"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base lg:text-xl font-extrabold tracking-tight text-primary uppercase truncate">
            {title}
          </h2>
          <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground font-medium truncate">
            {description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {action && <div>{action}</div>}
        {Icon && (
          <div className="hidden sm:flex h-10 w-10 lg:h-12 lg:w-12 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
            <Icon className="h-5 w-5 lg:h-6 lg:w-6 text-primary animate-pulse-subtle" />
          </div>
        )}
      </div>
    </div>
  </div>
);

export default AdminPageHeader;
