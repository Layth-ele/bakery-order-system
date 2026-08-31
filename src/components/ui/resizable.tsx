"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import { cn } from "./utils";

// react-resizable-panels may not export these names in all versions
// Cast to any to avoid type errors
let PanelGroupLib: any;
let PanelLib: any;
let PanelResizeHandleLib: any;

try {
  const panels = require("react-resizable-panels");
  PanelGroupLib = panels.PanelGroup || panels.ResizablePanelGroup || panels.default?.PanelGroup;
  PanelLib = panels.Panel || panels.ResizablePanel || panels.default?.Panel;
  PanelResizeHandleLib = panels.PanelResizeHandle || panels.ResizableHandle || panels.default?.PanelResizeHandle;
} catch {
  PanelGroupLib = ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>;
  PanelLib = ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>;
  PanelResizeHandleLib = ({ className, ...props }: any) => <div className={cn("bg-border w-px", className)} {...props} />;
}

function ResizablePanelGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { direction?: "horizontal" | "vertical" }) {
  const Comp = PanelGroupLib;
  return (
    <Comp
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const Comp = PanelLib;
  return <Comp data-slot="resizable-panel" className={className} {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { withHandle?: boolean }) {
  const Comp = PanelResizeHandleLib;
  return (
    <Comp
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Comp>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
