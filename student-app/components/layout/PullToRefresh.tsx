"use client";

import React, {
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  RefreshCw,
  ArrowDown,
  CheckCircle2,
} from "lucide-react";

interface PullToRefreshProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
}

export function PullToRefresh({
  children,
  className = "",
  threshold = 72,
}: PullToRefreshProps) {
  const containerRef =
    useRef<HTMLDivElement>(
      null,
    );

  const touchStartY =
    useRef<number | null>(
      null,
    );

  const tracking =
    useRef(false);

  const [
    pullDistance,
    setPullDistance,
  ] = useState(0);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    refreshed,
    setRefreshed,
  ] = useState(false);

  function shouldTrackTouch(
    target: EventTarget | null,
  ): boolean {
    const container =
      containerRef.current;

    if (
      !container ||
      !(target instanceof
        HTMLElement)
    ) {
      return false;
    }

    if (
      target.closest(
        "[data-ptr-ignore='true']",
      )
    ) {
      return false;
    }

    let node:
      | HTMLElement
      | null =
      target;

    while (
      node &&
      node !== container
    ) {
      const styles =
        window.getComputedStyle(
          node,
        );

      const overflowY =
        styles.overflowY;

      const isScrollable =
        (
          overflowY ===
            "auto" ||
          overflowY ===
            "scroll"
        ) &&
        node.scrollHeight >
          node.clientHeight;

      if (
        isScrollable
      ) {
        /*
         * A nested scroll area owns this gesture.
         * Never hijack its touch interaction.
         */
        return false;
      }

      node =
        node.parentElement;
    }

    return (
      container.scrollTop <=
      0
    );
  }

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const handleTouchStart =
      (
        event: TouchEvent,
      ) => {
        if (
          refreshing
        ) {
          return;
        }

        if (
          !shouldTrackTouch(
            event.target,
          )
        ) {
          return;
        }

        const touch =
          event.touches[0];

        if (!touch) {
          return;
        }

        touchStartY.current =
          touch.clientY;

        tracking.current =
          true;

        setRefreshed(
          false,
        );
      };

    const handleTouchMove =
      (
        event: TouchEvent,
      ) => {
        if (
          !tracking.current ||
          touchStartY.current ===
            null ||
          refreshing
        ) {
          return;
        }

        const touch =
          event.touches[0];

        if (!touch) {
          return;
        }

        const delta =
          touch.clientY -
          touchStartY.current;

        if (
          delta <= 0
        ) {
          setPullDistance(
            0,
          );

          return;
        }

        if (
          container.scrollTop >
          0
        ) {
          tracking.current =
            false;

          setPullDistance(
            0,
          );

          return;
        }

        /*
         * Resistance makes it feel like a native mobile pull gesture.
         */
        const distance =
          Math.min(
            delta * 0.55,
            threshold + 36,
          );

        /*
         * Prevent the browser from scrolling the page while the user
         * is actively pulling from the top.
         */
        event.preventDefault();

        setPullDistance(
          distance,
        );
      };

    const handleTouchEnd =
      async () => {
        if (
          !tracking.current
        ) {
          return;
        }

        tracking.current =
          false;

        touchStartY.current =
          null;

        const shouldRefresh =
          pullDistance >=
          threshold;

        if (
          shouldRefresh &&
          !refreshing
        ) {
          setRefreshing(
            true,
          );

          setPullDistance(
            58,
          );

          /*
           * Small visual delay so the user sees the release state
           * before the document reloads.
           */
          await new Promise<void>(
            (
              resolve,
            ) =>
              window.setTimeout(
                resolve,
                220,
              ),
          );

          setRefreshed(
            true,
          );

          window.location.reload();

          return;
        }

        setPullDistance(
          0,
        );
      };

    const handleTouchCancel =
      () => {
        tracking.current =
          false;

        touchStartY.current =
          null;

        setPullDistance(
          0,
        );
      };

    container.addEventListener(
      "touchstart",
      handleTouchStart,
      {
        passive: true,
      },
    );

    container.addEventListener(
      "touchmove",
      handleTouchMove,
      {
        passive: false,
      },
    );

    container.addEventListener(
      "touchend",
      handleTouchEnd,
      {
        passive: true,
      },
    );

    container.addEventListener(
      "touchcancel",
      handleTouchCancel,
      {
        passive: true,
      },
    );

    return () => {
      container.removeEventListener(
        "touchstart",
        handleTouchStart,
      );

      container.removeEventListener(
        "touchmove",
        handleTouchMove,
      );

      container.removeEventListener(
        "touchend",
        handleTouchEnd,
      );

      container.removeEventListener(
        "touchcancel",
        handleTouchCancel,
      );
    };
  }, [
    pullDistance,
    refreshing,
    threshold,
  ]);

  const progress =
    Math.min(
      pullDistance /
        threshold,
      1,
    );

  const reachedThreshold =
    pullDistance >=
    threshold;

  return (
    <div
      ref={
        containerRef
      }
      className={`relative min-h-0 overflow-y-auto overscroll-y-contain ${className}`}
    >
      <div
        className="flex w-full items-end justify-center overflow-hidden bg-slate-50"
        style={{
          height:
            refreshing ||
            pullDistance > 0
              ? Math.max(
                  pullDistance,
                  8,
                )
              : 0,
          transition:
            refreshing ||
            pullDistance === 0
              ? "height 180ms ease"
              : "none",
        }}
        aria-hidden="true"
      >
        <div
          className="mb-2 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 shadow-sm"
          style={{
            opacity:
              Math.min(
                1,
                Math.max(
                  0.25,
                  progress,
                ),
              ),
          }}
        >
          {refreshing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-mota-700" />

              <span>
                Reloading…
              </span>
            </>
          ) : refreshed ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />

              <span>
                Refreshed
              </span>
            </>
          ) : reachedThreshold ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-mota-700" />

              <span>
                Release to refresh
              </span>
            </>
          ) : (
            <>
              <ArrowDown
                className="w-3.5 h-3.5 text-slate-500"
                style={{
                  transform: `rotate(${Math.min(
                    progress * 180,
                    180,
                  )}deg)`,
                }}
              />

              <span>
                Pull to refresh
              </span>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
