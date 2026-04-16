export interface BaseProps {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  createdBy?: string;
  deletedBy?: string;
}

export class BaseEntity<T> {
  private _id?: string;
  private _createdAt?: Date;
  private _updatedAt?: Date;
  private _deletedAt?: Date;
  private _createdBy?: string;
  private _deletedBy?: string;

  constructor(props: BaseProps) {
    this._id = props.id;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
    this._deletedAt = props.deletedAt;
    this._createdBy = props.createdBy;
    this._deletedBy = props.deletedBy;
  }

  get id() {
    return this._id;
  }

  get createdAt() {
    return this._createdAt;
  }

  get updatedAt() {
    return this._updatedAt;
  }
  set updatedAt(value: Date | undefined) {
    this._updatedAt = value;
  }

  get deletedAt() {
    return this._deletedAt;
  }
  set deletedAt(value: Date | undefined) {
    this._deletedAt = value;
  }

  get createdBy() {
    return this._createdBy;
  }
  set createdBy(value: string | undefined) {
    this._createdBy = value;
  }

  get deletedBy() {
    return this._deletedBy;
  }
  set deletedBy(value: string | undefined) {
    this._deletedBy = value;
  }

  public update(fields: Partial<T>) {
    Object.assign(this, fields);
    this._updatedAt = new Date();
  }

  public softDelete(userId: string) {
    this._deletedAt = new Date();
    this._deletedBy = userId;
  }
}
