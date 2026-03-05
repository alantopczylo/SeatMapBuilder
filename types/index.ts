export interface Seat {
  id: string;
  label: string;
  x: number;
  y: number;
  status: string;
  categoryId?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface BaseMapElement {
  id: string;
  type: 'row' | 'table' | 'area' | 'text';
  label: string;
  x: number;
  y: number;
  rotation?: number;
  categoryId?: string;
}

export interface Row extends BaseMapElement {
  type: 'row';
  seats: Seat[];
}

export interface Table extends BaseMapElement {
  type: 'table';
  seats: Seat[];
}

export interface Area extends BaseMapElement {
  type: 'area';
  width: number;
  height: number;
}

export interface TextElement extends BaseMapElement {
  type: 'text';
  fontSize?: number;
  color?: string;
}

export type MapElement = Row | Table | Area | TextElement;
