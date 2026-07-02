export interface Profile {
  id: string;
  username: string;
  role: 'admin' | 'user';
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  erp_sku: string;
  erp_image_url: string;
  ozon_sku: string;
  ozon_image_url: string;
  usd_price: number;
  judgment_status: 'unjudged' | 'yes' | 'no';
  created_by: string;
  created_at: string;
  updated_at: string;
  judged_by?: string;
  judged_at?: string;
  import_batch_id?: string;
}

export interface TaskAssignment {
  id: string;
  product_id: string;
  assigned_user_id: string;
  status: 'claimed' | 'draft' | 'submitted' | 'reclaimed';
  claimed_at: string;
  submitted_at?: string;
  judgment_result?: 'yes' | 'no' | null;
  judgment_note?: string;
  reclaimed_by?: string;
  reclaimed_at?: string;
  product?: Product; // for joined queries
  assignee?: Profile; // for admin queries
}

export interface UserProductLibrary {
  id: string;
  user_id: string;
  product_id: string;
  source_type: string;
  received_at: string;
  export_batch_id?: string;
  product?: Product;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string;
}

export interface AuditLog {
  id: string;
  operator_id: string;
  operation_type: string;
  target_type: string;
  target_id: string;
  detail: string;
  created_at: string;
  operator?: { username: string };
}

