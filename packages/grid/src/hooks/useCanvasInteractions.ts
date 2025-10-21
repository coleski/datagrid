import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { MutableRefObject, RefObject, Dispatch, SetStateAction } from 'react';
import type { AnchorCalculator } from '../utils/anchorCalculations';
import type { DataManager } from '../data/DataManager';
import type { GridHandle, SelectionRange } from '../types';
// Column drag visuals are controller-managed; no layout helpers needed here
import { SCROLLBAR_WIDTH } from '../constants';

// Minimal copies of types from useColumnResize to avoid cross-import
export interface TryBeginResizeArgs {
  x: number;
  y: number;
  currentState: ReturnType<GridHandle['getState']>;
  resizable: boolean;
  theme?: import('../types').ThemeTokens | null;
}

export interface ResizePointerMoveArgs {
  x: number;
  y: number;
  theme: import('../types').ThemeTokens | null;
  currentState: ReturnType<GridHandle['getState']>;
  resizable: boolean;
  overVerticalScrollbar: boolean;
  overHorizontalScrollbar: boolean;
}

// Remove import from deprecated useColumnDrag and define local interface instead
// No local column drag state; handled in controller

// Drag threshold handled in controller

interface ScrollDragState {
  type: 'vertical-scrollbar' | 'horizontal-scrollbar' | null;
  startMousePos: number;
  startScrollPos: number;
  pointerOffset: number;
}

interface CellDragState {
  isDragging: boolean;
  startCell: { row: number; col: number } | null;
  autoScrollInterval: ReturnType<typeof setInterval> | null;
}

interface UseCanvasInteractionsParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  anchorCalculatorRef: MutableRefObject<AnchorCalculator | null>;
  dataManagerRef: MutableRefObject<DataManager | null>;
  handle: GridHandle;
  focusElementRef: MutableRefObject<HTMLElement | null>;
  keyboardManagerRef: MutableRefObject<{ focusCell: (row: number, col: number, expand: boolean) => void } | null>;
  draggableColumns: boolean;
  resizable: boolean;
  theme: import('../types').ThemeTokens | null;
  onCellClick?: (info: { row: number; col: number; dataCol: number; value: string }) => void;
  onRowClick?: (info: { row: number }) => void;
  onColumnClick?: (info: { col: number; dataCol: number }) => void;
  onContextMenu?: (info: { row: number | null; col: number | null; dataCol: number | null; clientX: number; clientY: number }, event: React.MouseEvent<HTMLCanvasElement>) => void;
  setHoverHighlight: (range: SelectionRange | null) => void;
  setHoveredCellIfChanged: (cell: { row: number; col: number } | null) => void;
  setScrollbarHovering: Dispatch<SetStateAction<boolean>>;
  setScrollbarDragging: Dispatch<SetStateAction<boolean>>;
  scrollbarDragging: boolean;
  setHoveringVerticalThumb: Dispatch<SetStateAction<boolean>>;
  setHoveringHorizontalThumb: Dispatch<SetStateAction<boolean>>;
  hoveringVerticalThumb: boolean;
  hoveringHorizontalThumb: boolean;
  lastMousePosRef: MutableRefObject<{ x: number; y: number } | null>;
  dragStateRef: MutableRefObject<ScrollDragState>;
  handleResizePointerMove: (args: ResizePointerMoveArgs) => boolean;
  hideResizeHandles: (immediate?: boolean) => void;
  tryBeginResize: (args: TryBeginResizeArgs) => boolean;
  finishColumnResize: () => void;
  cancelResizeHover: () => void;
  // Column drag visuals fully controller-managed; only need order for callbacks
  columnOrder: number[];
  scrollTop: number;
  scrollLeft: number;
  drawRef: MutableRefObject<() => void>;
  onDispatchEvent?: (ev: { type: 'pointerMove' | 'pointerDown' | 'pointerUp' | 'pointerLeave' | 'contextMenu'; payload: any }) => void;
  // When controller is dragging a column, this ref is non-null
  controllerDragVisualRef?: MutableRefObject<any | null>;
}

interface CanvasInteractionHandlers {
  handleMouseMove: React.MouseEventHandler<HTMLCanvasElement>;
  handleMouseDown: React.MouseEventHandler<HTMLCanvasElement>;
  handleMouseUp: React.MouseEventHandler<HTMLCanvasElement>;
  handleMouseLeave: React.MouseEventHandler<HTMLCanvasElement>;
  handleContextMenu: React.MouseEventHandler<HTMLCanvasElement>;
}

export function useCanvasInteractions(params: UseCanvasInteractionsParams): CanvasInteractionHandlers {
  const {
    canvasRef,
    anchorCalculatorRef,
    dataManagerRef,
    handle,
    focusElementRef,
    keyboardManagerRef,
    draggableColumns,
    resizable,
    theme,
    onCellClick,
    onRowClick,
    onColumnClick,
    onContextMenu,
    setHoverHighlight,
    setHoveredCellIfChanged,
    setScrollbarHovering,
    setScrollbarDragging,
    scrollbarDragging,
    setHoveringVerticalThumb,
    setHoveringHorizontalThumb,
    hoveringVerticalThumb,
    hoveringHorizontalThumb,
    lastMousePosRef,
    dragStateRef,
    handleResizePointerMove,
    hideResizeHandles,
    tryBeginResize,
    finishColumnResize,
    cancelResizeHover,
    columnOrder,
    scrollTop,
    scrollLeft,
    drawRef,
    onDispatchEvent,
    controllerDragVisualRef,
  } = params;

  // Track cell drag-to-select state
  const cellDragStateRef = useRef<CellDragState>({
    isDragging: false,
    startCell: null,
    autoScrollInterval: null,
  });

  // Auto-scroll edge threshold (in pixels)
  const AUTO_SCROLL_THRESHOLD = 30;
  const AUTO_SCROLL_SPEED = 10;

  // Helper to clear auto-scroll interval
  const clearAutoScroll = useCallback(() => {
    if (cellDragStateRef.current.autoScrollInterval) {
      clearInterval(cellDragStateRef.current.autoScrollInterval);
      cellDragStateRef.current.autoScrollInterval = null;
    }
  }, []);

  // Helper to handle auto-scrolling when dragging near edges
  const handleAutoScroll = useCallback((x: number, y: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const currentState = handle.getState();
    if (!currentState) return;

    let scrollDx = 0;
    let scrollDy = 0;

    // Check vertical edges
    if (y < AUTO_SCROLL_THRESHOLD) {
      scrollDy = -AUTO_SCROLL_SPEED;
    } else if (y > rect.height - AUTO_SCROLL_THRESHOLD) {
      scrollDy = AUTO_SCROLL_SPEED;
    }

    // Check horizontal edges
    if (x < AUTO_SCROLL_THRESHOLD) {
      scrollDx = -AUTO_SCROLL_SPEED;
    } else if (x > rect.width - AUTO_SCROLL_THRESHOLD) {
      scrollDx = AUTO_SCROLL_SPEED;
    }

    if (scrollDx !== 0 || scrollDy !== 0) {
      if (!cellDragStateRef.current.autoScrollInterval) {
        cellDragStateRef.current.autoScrollInterval = setInterval(() => {
          const state = handle.getState();
          const newScrollTop = Math.max(0, state.scrollTop + scrollDy);
          const newScrollLeft = Math.max(0, state.scrollLeft + scrollDx);
          handle.setScroll(newScrollTop, newScrollLeft);

          // Update selection with current mouse position
          if (cellDragStateRef.current.isDragging && cellDragStateRef.current.startCell && anchorCalculatorRef.current) {
            const mousePos = lastMousePosRef.current;
            if (mousePos) {
              const endCell = anchorCalculatorRef.current.getCellFromPoint(mousePos.x, mousePos.y);
              if (endCell) {
                handle.setSelection({
                  type: 'cell',
                  start: cellDragStateRef.current.startCell,
                  end: endCell,
                });
              }
            }
          }
        }, 50);
      }
    } else {
      clearAutoScroll();
    }
  }, [canvasRef, handle, anchorCalculatorRef, lastMousePosRef, clearAutoScroll]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!anchorCalculatorRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (onDispatchEvent) onDispatchEvent({ type: 'pointerMove', payload: { x, y, nativeEvent: event } });
    lastMousePosRef.current = { x, y };

    // Handle cell drag-to-select
    if (cellDragStateRef.current.isDragging && cellDragStateRef.current.startCell) {
      const endCell = anchorCalculatorRef.current.getCellFromPoint(x, y);
      if (endCell) {
        handle.setSelection({
          type: 'cell',
          start: cellDragStateRef.current.startCell,
          end: endCell,
        });
      }

      // Check if near edges to trigger auto-scroll
      handleAutoScroll(x, y);
      return;
    }

    // Swallow interactions while dragging a scrollbar (controller handles scroll)
    if (dragStateRef.current.type) {
      event.preventDefault();
      setHoverHighlight(null);
      setHoveredCellIfChanged(null);
      return;
    }

    const currentState = handle.getState();
    // Column drag visuals handled by controller

    const overVScrollbar = x >= rect.width - SCROLLBAR_WIDTH && currentState?.scrollbarState?.vertical?.visible;
    const overHScrollbar = y >= rect.height - SCROLLBAR_WIDTH && currentState?.scrollbarState?.horizontal?.visible;

    let vThumbHover = false;
    let hThumbHover = false;
    if (overVScrollbar && currentState?.scrollbarState?.vertical?.visible) {
      const v = currentState.scrollbarState.vertical;
      vThumbHover = y >= v.thumbTop && y <= v.thumbTop + v.thumbHeight && x >= rect.width - SCROLLBAR_WIDTH && x <= rect.width;
    }
    if (overHScrollbar && currentState?.scrollbarState?.horizontal?.visible) {
      const h = currentState.scrollbarState.horizontal;
      hThumbHover = x >= h.thumbLeft && x <= h.thumbLeft + h.thumbWidth && y >= rect.height - SCROLLBAR_WIDTH && y <= rect.height;
    }
    if (dragStateRef.current.type === 'vertical-scrollbar' && currentState?.scrollbarState?.vertical?.visible) {
      vThumbHover = true;
    }
    if (dragStateRef.current.type === 'horizontal-scrollbar' && currentState?.scrollbarState?.horizontal?.visible) {
      hThumbHover = true;
    }
    const thumbChanged = (vThumbHover !== hoveringVerticalThumb) || (hThumbHover !== hoveringHorizontalThumb);
    if (thumbChanged) {
      setHoveringVerticalThumb(vThumbHover);
      setHoveringHorizontalThumb(hThumbHover);
      try { drawRef.current(); } catch { }
    }

    setScrollbarHovering(true);

    const resizeHandled = handleResizePointerMove({
      x,
      y,
      theme,
      currentState,
      resizable,
      overVerticalScrollbar: overVScrollbar,
      overHorizontalScrollbar: overHScrollbar,
    });
    if (resizeHandled) {
      return;
    }

    if (!dragStateRef.current.type) {
      setHoveringVerticalThumb(prev => (prev ? false : prev));
      setHoveringHorizontalThumb(prev => (prev ? false : prev));
    }

    // Column drag threshold is controller-managed

    let highlight: SelectionRange | null = null;
    let cellPos: { row: number; col: number } | null = null;

    if (anchorCalculatorRef.current.isPointInHeader(x, y)) {
      const headerCol = anchorCalculatorRef.current.getHeaderColumnFromPoint(x, y);
      if (headerCol != null) {
        highlight = { type: 'column', startCol: headerCol, endCol: headerCol };
      }
      setHoveredCellIfChanged(null);
    } else if (anchorCalculatorRef.current.isPointInGutter?.(x, y)) {
      const rowIndex = anchorCalculatorRef.current.getRowFromPoint(y);
      if (rowIndex != null) {
        highlight = { type: 'row', startRow: rowIndex, endRow: rowIndex };
      }
      setHoveredCellIfChanged(null);
    } else {
      cellPos = anchorCalculatorRef.current.getCellFromPoint(x, y);
      if (cellPos) {
        highlight = { type: 'cell', start: cellPos, end: cellPos };
      }
      setHoveredCellIfChanged(cellPos);
    }

    setHoverHighlight(highlight);
  }, [
    anchorCalculatorRef,
    canvasRef,
    draggableColumns,
    dragStateRef,
    handle,
    handleResizePointerMove,
    hideResizeHandles,
    hoveringHorizontalThumb,
    hoveringVerticalThumb,
    lastMousePosRef,
    resizable,
    setHoverHighlight,
    setHoveredCellIfChanged,
    setHoveringHorizontalThumb,
    setHoveringVerticalThumb,
    setScrollbarHovering,
    theme,
    drawRef,
    onDispatchEvent,
    handleAutoScroll,
  ]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!anchorCalculatorRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const currentState = handle.getState();
    const overVScrollbar = x >= rect.width - SCROLLBAR_WIDTH && currentState?.scrollbarState?.vertical?.visible;
    const overHScrollbar = y >= rect.height - SCROLLBAR_WIDTH && currentState?.scrollbarState?.horizontal?.visible;

    if (overVScrollbar) {
      const v = currentState.scrollbarState.vertical;
      const inThumb = v && typeof v.thumbTop === 'number' && typeof v.thumbHeight === 'number'
        ? (y >= v.thumbTop && y <= v.thumbTop + v.thumbHeight)
        : false;
      event.preventDefault();
      if (inThumb) {
        const pointerOffset = (event.clientY - rect.top) - (v?.thumbTop ?? 0);
        dragStateRef.current = {
          type: 'vertical-scrollbar',
          startMousePos: event.clientY,
          startScrollPos: scrollTop,
          pointerOffset,
        };
        setScrollbarDragging(true);
        if (onDispatchEvent) onDispatchEvent({ type: 'pointerDown', payload: { x, y, nativeEvent: event } });
      }
      // Swallow track clicks to avoid selecting cells behind
      return;
    }

    if (overHScrollbar) {
      const h = currentState.scrollbarState.horizontal;
      const inThumb = h && typeof h.thumbLeft === 'number' && typeof h.thumbWidth === 'number'
        ? (x >= h.thumbLeft && x <= h.thumbLeft + h.thumbWidth)
        : false;
      event.preventDefault();
      if (inThumb) {
        const pointerOffset = (event.clientX - rect.left) - (h?.thumbLeft ?? 0);
        dragStateRef.current = {
          type: 'horizontal-scrollbar',
          startMousePos: event.clientX,
          startScrollPos: scrollLeft,
          pointerOffset,
        };
        setScrollbarDragging(true);
        if (onDispatchEvent) onDispatchEvent({ type: 'pointerDown', payload: { x, y, nativeEvent: event } });
      }
      // Swallow track clicks to avoid selecting cells behind
      return;
    }

    if (onDispatchEvent) onDispatchEvent({ type: 'pointerDown', payload: { x, y, nativeEvent: event } });

    focusElementRef.current?.focus();

    // Column drag lifecycle is controller-managed

    if (tryBeginResize({ x, y, currentState, resizable, theme })) {
      event.preventDefault();
      return;
    }

    if (anchorCalculatorRef.current.isPointInHeader(x, y)) {
      const col = anchorCalculatorRef.current.getHeaderColumnFromPoint(x, y);
      if (col !== null) {
        handle.setSelection({ type: 'column', startCol: col, endCol: col });
        if (onColumnClick) {
          const dataCol = Array.isArray(columnOrder) && col < columnOrder.length ? (columnOrder[col] ?? col) : col;
          onColumnClick({ col, dataCol });
        }
        // Column drag initiation handled by controller
      }
      return;
    }

    if (anchorCalculatorRef.current.isPointInGutter?.(x, y)) {
      const row = anchorCalculatorRef.current.getRowFromPoint(y);
      if (row !== null && row >= 0) {
        handle.setSelection({ type: 'row', startRow: row, endRow: row });
        if (onRowClick) onRowClick({ row });
        return;
      }
    }

    const cellPos = anchorCalculatorRef.current.getCellFromPoint(x, y);
    if (cellPos && dataManagerRef.current) {
      const dataCol = Array.isArray(columnOrder) && cellPos.col < columnOrder.length ? (columnOrder[cellPos.col] ?? cellPos.col) : cellPos.col;
      const value = dataManagerRef.current.getCell(cellPos.row, dataCol);

      if (onCellClick) {
        onCellClick({ row: cellPos.row, col: cellPos.col, dataCol, value });
      }

      if (onRowClick) {
        onRowClick({ row: cellPos.row });
      }

      handle.setSelection({ type: 'cell', start: cellPos, end: cellPos });
      keyboardManagerRef.current?.focusCell(cellPos.row, cellPos.col, false);

      // Start drag-to-select
      cellDragStateRef.current = {
        isDragging: true,
        startCell: cellPos,
        autoScrollInterval: null,
      };
    }
  }, [
    anchorCalculatorRef,
    canvasRef,
    dataManagerRef,
    draggableColumns,
    dragStateRef,
    focusElementRef,
    columnOrder,
    handle,
    keyboardManagerRef,
    onCellClick,
    onColumnClick,
    onRowClick,
    resizable,
    scrollLeft,
    scrollTop,
    setScrollbarDragging,
    tryBeginResize,
    onDispatchEvent,
  ]);

  const handleMouseUp = useCallback(() => {
    if (onDispatchEvent) onDispatchEvent({ type: 'pointerUp', payload: {} });

    // Stop cell drag-to-select
    if (cellDragStateRef.current.isDragging) {
      cellDragStateRef.current.isDragging = false;
      cellDragStateRef.current.startCell = null;
      clearAutoScroll();
    }

    if (dragStateRef.current.type) {
      dragStateRef.current = { type: null, startMousePos: 0, startScrollPos: 0, pointerOffset: 0 };
      setScrollbarDragging(false);
      setHoveringVerticalThumb(false);
      setHoveringHorizontalThumb(false);
      try { drawRef.current(); } catch { }
    }
    finishColumnResize();
  }, [
    draggableColumns,
    dragStateRef,
    finishColumnResize,
    drawRef,
    setHoveringHorizontalThumb,
    setHoveringVerticalThumb,
    setScrollbarDragging,
    onDispatchEvent,
    clearAutoScroll,
  ]);

  // Keep drag interactions alive off-canvas for scrollbar and column drag
  useEffect(() => {
    const columnDragging = !!(controllerDragVisualRef && controllerDragVisualRef.current);
    if (!scrollbarDragging && !columnDragging) return;
    const onMove = (e: MouseEvent | PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (onDispatchEvent) onDispatchEvent({ type: 'pointerMove', payload: { x, y, nativeEvent: e } });
      try { (e as any).preventDefault?.(); } catch {}
    };
    const onUp = (e: MouseEvent | PointerEvent) => {
      try { (e as any).preventDefault?.(); } catch {}
      // Use existing handler to properly end local and controller drag states
      handleMouseUp();
    };
    window.addEventListener('pointermove', onMove as any, { passive: false } as any);
    window.addEventListener('mousemove', onMove as any, { passive: false } as any);
    window.addEventListener('pointerup', onUp as any, { passive: false } as any);
    window.addEventListener('mouseup', onUp as any, { passive: false } as any);
    return () => {
      window.removeEventListener('pointermove', onMove as any);
      window.removeEventListener('mousemove', onMove as any);
      window.removeEventListener('pointerup', onUp as any);
      window.removeEventListener('mouseup', onUp as any);
    };
  }, [scrollbarDragging, controllerDragVisualRef?.current, onDispatchEvent, canvasRef, handleMouseUp]);

  const handleMouseLeave = useCallback(() => {
    if (onDispatchEvent) onDispatchEvent({ type: 'pointerLeave', payload: {} });

    // Stop cell drag-to-select
    if (cellDragStateRef.current.isDragging) {
      cellDragStateRef.current.isDragging = false;
      cellDragStateRef.current.startCell = null;
      clearAutoScroll();
    }

    cancelResizeHover();
    setHoveredCellIfChanged(null);
    setScrollbarHovering(false);
    if (!dragStateRef.current.type) {
      if (hoveringVerticalThumb) setHoveringVerticalThumb(false);
      if (hoveringHorizontalThumb) setHoveringHorizontalThumb(false);
    }
    setHoverHighlight(null);
    lastMousePosRef.current = null;
    try { drawRef.current(); } catch { }
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
  }, [
    cancelResizeHover,
    canvasRef,
    dragStateRef,
    drawRef,
    hoveringHorizontalThumb,
    hoveringVerticalThumb,
    lastMousePosRef,
    setHoverHighlight,
    setHoveredCellIfChanged,
    setHoveringHorizontalThumb,
    setHoveringVerticalThumb,
    setScrollbarHovering,
    onDispatchEvent,
    clearAutoScroll,
  ]);

  // Cleanup auto-scroll interval on unmount
  useEffect(() => {
    return () => {
      clearAutoScroll();
    };
  }, [clearAutoScroll]);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onContextMenu || !anchorCalculatorRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let row: number | null = null;
    let col: number | null = null;
    let dataCol: number | null = null;

    if (anchorCalculatorRef.current.isPointInHeader(x, y)) {
      col = anchorCalculatorRef.current.getHeaderColumnFromPoint(x, y);
      if (col != null) {
        dataCol = Array.isArray(columnOrder) && col < columnOrder.length ? (columnOrder[col] ?? col) : col;
      }
    } else {
      const cellPos = anchorCalculatorRef.current.getCellFromPoint(x, y);
      if (cellPos) {
        row = cellPos.row;
        col = cellPos.col;
        dataCol = Array.isArray(columnOrder) && cellPos.col < columnOrder.length ? (columnOrder[cellPos.col] ?? cellPos.col) : cellPos.col;
      }
    }

    if (onDispatchEvent) onDispatchEvent({ type: 'contextMenu', payload: { x, y, clientX: event.clientX, clientY: event.clientY, nativeEvent: event } });
    onContextMenu(
      { row, col, dataCol, clientX: event.clientX, clientY: event.clientY },
      event,
    );
  }, [anchorCalculatorRef, canvasRef, columnOrder, onContextMenu, onDispatchEvent]);

  return {
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
  };
}
