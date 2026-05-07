import { BaseEntity, BaseProps } from '@shared/entities/base';

import { SecurityEventType, SecuritySeverity } from '../security-log.types';

interface SecurityLogProps {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string | null;
  clienteId?: string | null;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  message: string;
  metadata?: Record<string, unknown> | null;
}

export class SecurityLog extends BaseEntity<SecurityLogProps> {
  private props: SecurityLogProps;

  constructor(props: SecurityLogProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get eventType() { return this.props.eventType; }
  get severity() { return this.props.severity; }
  get userId() { return this.props.userId; }
  get clienteId() { return this.props.clienteId; }
  get role() { return this.props.role; }
  get ip() { return this.props.ip; }
  get userAgent() { return this.props.userAgent; }
  get method() { return this.props.method; }
  get path() { return this.props.path; }
  get statusCode() { return this.props.statusCode; }
  get message() { return this.props.message; }
  get metadata() { return this.props.metadata; }
}
