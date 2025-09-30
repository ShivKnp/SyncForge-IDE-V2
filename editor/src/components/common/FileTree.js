// src/components/common/FileTree.js (Enhanced with Complete Features)
import React, { useState, useEffect } from 'react';
import { Button, Tooltip, Modal, Input, Form, Alert, message,notification } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined, 
  FileOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  PlusOutlined,
  CaretRightOutlined,
  CaretDownOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { FaFolder } from "react-icons/fa";

// Delete Confirmation Modal Component
const DeleteConfirmationModal = ({ 
  visible, 
  onCancel, 
  onConfirm, 
  itemName,
  itemType,
  isRoot = false
}) => {
  if (isRoot) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <div className="terminal-toggle active" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <ExclamationCircleOutlined className="terminal-icon" />
          </div>
          <span className="text-slate-100 font-semibold text-sm">Cannot Delete Root</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button 
          key="ok" 
          onClick={onCancel} 
          className="modal-cancel-btn"
        >
          OK
        </Button>
      ]}
      className="delete-confirmation-modal root-delete-modal"
      width={440}
      transitionName="ant-zoom"
      maskTransitionName="ant-fade"
      styles={{
        body: { 
          padding: '20px',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
          color: '#e2e8f0',
          borderRadius: '0 0 12px 12px',
          backdropFilter: 'blur(20px)',
        },
        header: {
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
          borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
          color: '#e2e8f0',
          borderRadius: '12px 12px 0 0',
          padding: '16px 20px',
          minHeight: 'auto'
        },
        content: {
          backgroundColor: 'transparent',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(245, 158, 11, 0.1)',
          border: 'none'
        },
        footer: {
          background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
          borderTop: '1px solid rgba(245, 158, 11, 0.1)',
          borderRadius: '0 0 12px 12px',
          padding: '16px 20px',
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }
      }}
      closeIcon={
        <div className="modal-close-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M13 1L1 13M1 1L13 13" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          </svg>
        </div>
      }
    >
      <div className="space-y-4 modal-content-inner">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
          <div className="flex-shrink-0">
            <ExclamationCircleOutlined className="text-amber-400 text-lg transition-transform duration-300 hover:scale-110" />
          </div>
          <div className="flex-1">
            <div className="text-slate-200 font-medium text-sm">Root directory is protected</div>
            <div className="text-slate-400 text-xs mt-1 leading-relaxed">
              The root directory cannot be deleted as it is the foundation of your project structure.
            </div>
          </div>
        </div>
        
        <div className="text-slate-400 text-xs leading-relaxed animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
          Consider creating folders within the root to organize your files instead.
        </div>
      </div>
    </Modal>
  );
}

return (
  <Modal
    title={
      <div className="flex items-center gap-2">
        <div className="terminal-toggle active" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <ExclamationCircleOutlined className="terminal-icon" />
        </div>
        <span className="text-slate-100 font-semibold text-sm">Confirm Delete</span>
      </div>
    }
    open={visible}
    onOk={onConfirm}
    onCancel={onCancel}
    okText="Delete"
    cancelText="Cancel"
    className="delete-confirmation-modal file-delete-modal"
    width={460}
    transitionName="ant-zoom"
    maskTransitionName="ant-fade"
    styles={{
      body: { 
        padding: '20px',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
        color: '#e2e8f0',
        borderRadius: '0 0 12px 12px',
        backdropFilter: 'blur(20px)',
      },
      header: {
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
        borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
        color: '#e2e8f0',
        borderRadius: '12px 12px 0 0',
        padding: '16px 20px',
        minHeight: 'auto'
      },
      content: {
        backgroundColor: 'transparent',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(239, 68, 68, 0.1)',
        border: 'none'
      },
      footer: {
        background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
        borderTop: '1px solid rgba(239, 68, 68, 0.1)',
        borderRadius: '0 0 12px 12px',
        padding: '16px 20px',
        marginTop: '8px',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px'
      }
    }}
    okButtonProps={{
      className: 'modal-delete-btn animate-pulse-once'
    }}
    cancelButtonProps={{
      className: 'modal-cancel-btn'
    }}
    closeIcon={
      <div className="modal-close-btn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M13 1L1 13M1 1L13 13" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="transition-all duration-300"
          />
        </svg>
      </div>
    }
  >
    <div className="space-y-4 modal-content-inner">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-rose-500/10 to-rose-600/5 border border-rose-500/20 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <div className="flex-shrink-0">
          <ExclamationCircleOutlined className="text-rose-400 text-lg transition-transform duration-300 hover:scale-110" />
        </div>
        <div className="flex-1">
          <div className="text-slate-200 font-medium text-sm">This action cannot be undone</div>
          <div className="text-slate-400 text-xs mt-1 leading-relaxed">
            You are about to permanently delete this {itemType}.
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-800/40 to-slate-700/30 rounded-lg p-4 border border-slate-700/30 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <div className="text-slate-300 text-sm font-medium mb-2 flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M6 3V9M3 6H9" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
          </svg>
          Item to be deleted:
        </div>
        <div className="text-slate-400 text-sm flex items-center gap-2 p-2 rounded bg-slate-800/20 border border-slate-700/20">
          {itemType === 'folder' ? 
            <FolderOutlined className="text-amber-400 transition-transform duration-300 hover:scale-110" /> : 
            <FileOutlined className="text-blue-400 transition-transform duration-300 hover:scale-110" />
          }
          <span className="font-mono text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded text-xs border border-cyan-500/20">
            {itemName}
          </span>
        </div>
        
        {itemType === 'folder' && (
          <div className="text-rose-400 text-xs mt-3 flex items-center gap-2 p-2 rounded bg-rose-500/10 border border-rose-500/20 animate-pulse">
            <ExclamationCircleOutlined className="text-rose-400" />
            <span>All contents inside this folder will also be deleted.</span>
          </div>
        )}
      </div>
    </div>
  </Modal>
);
};

// Create Item Modal Component
const CreateItemModal = ({ 
  visible, 
  onCancel, 
  onConfirm, 
  type, 
  parentNode,
  existingNames = [],
  tree = {}
}) => {
  const [form] = Form.useForm();
  const [validationError, setValidationError] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      form.resetFields();
      setValidationError('');
    }
  }, [visible, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const itemName = values.name.trim();
      
      // Validate name
      const validation = validateItemName(itemName, type, existingNames);
      
      if (!validation.isValid) {
        setValidationError(validation.error);
        return;
      }

      setValidationError('');
      onConfirm(itemName);
      form.resetFields();
    } catch (error) {
      // Form validation failed
      console.log('Validation failed:', error);
    }
  };

  const validateItemName = (name, itemType, existingNames) => {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: `${itemType === 'file' ? 'File' : 'Folder'} name is required` };
    }

    if (name.length > 255) {
      return { isValid: false, error: 'Name must be less than 255 characters' };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(name)) {
      return { isValid: false, error: 'Name contains invalid characters: < > : " / \\ | ? *' };
    }

    // Check for reserved names
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(name.toUpperCase())) {
      return { isValid: false, error: 'This name is reserved by the system' };
    }

    // Check for duplicate names
    if (existingNames.includes(name)) {
      return { isValid: false, error: `A ${itemType === 'file' ? 'file' : 'folder'} with this name already exists` };
    }

    // File-specific validations
    if (itemType === 'file') {
      if (name.endsWith('.') || name.endsWith(' ')) {
        return { isValid: false, error: 'File name cannot end with a dot or space' };
      }

      // Check for multiple extensions (basic check)
      const dots = name.split('.').length - 1;
      if (dots > 1 && !name.startsWith('.')) {
        // Allow names like .gitignore but warn about multiple extensions
        if (dots > 2) {
          return { isValid: false, error: 'File name contains too many dots' };
        }
      }
    }

    // Folder-specific validations
    if (itemType === 'folder') {
      if (name.endsWith('.') || name.endsWith(' ')) {
        return { isValid: false, error: 'Folder name cannot end with a dot or space' };
      }
    }

    return { isValid: true, error: '' };
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    if (name.trim()) {
      const validation = validateItemName(name, type, existingNames);
      setValidationError(validation.error || '');
    } else {
      setValidationError('');
    }
  };

  const getPlaceholder = () => {
    if (type === 'file') {
      return 'e.g., index.html, script.js, styles.css';
    }
    return 'e.g., src, components, assets';
  };

  const getDefaultName = () => {
    const baseName = type === 'file' ? 'new-file' : 'new-folder';
    let counter = 1;
    let newName = baseName;
    
    while (existingNames.includes(newName)) {
      newName = `${baseName}-${counter}`;
      counter++;
    }
    
    return newName;
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <div className="terminal-toggle active" style={{ 
            background: type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            borderColor: type === 'file' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'
          }}>
            {type === 'file' ? <FileOutlined className="terminal-icon" /> : <FolderOutlined className="terminal-icon" />}
          </div>
          <span className="text-slate-100 font-semibold text-sm">
            Create New {type === 'file' ? 'File' : 'Folder'}
          </span>
        </div>
      }
      open={visible}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        setValidationError('');
        onCancel();
      }}
      okText={`Create ${type === 'file' ? 'File' : 'Folder'}`}
      cancelText="Cancel"
      className="create-item-modal host-modal-style"
      width={480}
      transitionName="ant-zoom"
      maskTransitionName="ant-fade"
      styles={{
        body: { 
          padding: '20px',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
          color: '#e2e8f0',
          borderRadius: '0 0 12px 12px',
          backdropFilter: 'blur(20px)',
          opacity: 0,
          transform: 'scale(0.95) translateY(-10px)',
          animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
        },
        header: {
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
          borderBottom: `1px solid ${type === 'file' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
          color: '#e2e8f0',
          borderRadius: '12px 12px 0 0',
          padding: '16px 20px',
          minHeight: 'auto',
          opacity: 0,
          transform: 'translateY(-10px)',
          animation: 'modalHeaderEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'
        },
        content: {
          backgroundColor: 'transparent',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          boxShadow: `0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px ${type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
          border: 'none',
          opacity: 0,
          transform: 'scale(0.95)',
          animation: 'modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
        },
        footer: {
          background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
          borderTop: `1px solid ${type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
          borderRadius: '0 0 12px 12px',
          padding: '16px 20px',
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }
      }}
      okButtonProps={{
        className: type === 'file' ? 'modal-file-create-btn animate-pulse-once' : 'modal-folder-create-btn animate-pulse-once'
      }}
      cancelButtonProps={{
        className: 'modal-cancel-btn'
      }}
      closeIcon={
        <div className="modal-close-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M13 1L1 13M1 1L13 13" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          </svg>
        </div>
      }
      destroyOnClose
    >
      <div className="space-y-4 modal-content-inner">
        <div className="text-slate-400 text-sm animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
          Creating in: <span className="text-cyan-300 font-medium">{parentNode?.name || 'root'}</span>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ name: getDefaultName() }}
        >
          <Form.Item
            label={
              <span className="text-slate-300 text-sm font-medium animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                {type === 'file' ? 'File Name' : 'Folder Name'}
              </span>
            }
            name="name"
            rules={[
              { required: true, message: `Please enter a ${type === 'file' ? 'file' : 'folder'} name` },
            ]}
            help={validationError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs mt-1 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
                <ExclamationCircleOutlined />
                <span>{validationError}</span>
              </div>
            )}
            validateStatus={validationError ? 'error' : ''}
          >
            <Input
              placeholder={getPlaceholder()}
              onChange={handleNameChange}
              autoFocus
              className="modal-input animate-fadeInUp"
              style={{ animationDelay: '0.2s' }}
              onPressEnter={handleOk}
            />
          </Form.Item>
        </Form>

        {/* Help Text */}
        <div className="bg-gradient-to-r from-slate-800/40 to-slate-700/30 rounded-lg p-4 border border-slate-700/30 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <div className="text-xs text-slate-400 space-y-2">
            <div className="font-medium text-slate-300 mb-2 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M6 3V6M6 9H6.005M5 1H7C7.55228 1 8 1.44772 8 2V10C8 10.5523 7.55228 11 7 11H5C4.44772 11 4 10.5523 4 10V2C4 1.44772 4.44772 1 5 1Z" 
                  stroke="currentColor" 
                  strokeWidth="1.2" 
                  strokeLinecap="round"
                />
              </svg>
              Naming Rules:
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                <span>No: &lt; &gt; : " / \\ | ? *</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                <span>Max 255 characters</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                <span>No reserved names</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                <span>Must be unique</span>
              </div>
            </div>
            {type === 'file' && (
              <div className="flex items-center gap-1 mt-2 text-cyan-400">
                <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                <span>Include extension (e.g., .js, .html, .css)</span>
              </div>
            )}
          </div>
        </div>

        {/* Available names suggestion */}
        {validationError && validationError.includes('already exists') && (
          <div className="animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
            <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M6 3V6M6 9H6.005" 
                  stroke="currentColor" 
                  strokeWidth="1.2" 
                  strokeLinecap="round"
                />
              </svg>
              Available names:
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map(num => {
                const suggestion = `${type === 'file' ? 'new-file' : 'new-folder'}-${num}`;
                if (!existingNames.includes(suggestion)) {
                  return (
                    <button
                      key={suggestion}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 transition-all duration-300 hover:scale-105 hover:border-blue-500/40"
                      onClick={() => {
                        form.setFieldValue('name', suggestion);
                        setValidationError('');
                      }}
                    >
                      {suggestion}
                    </button>
                  );
                }
                return null;
              }).filter(Boolean)}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Rename Item Modal Component
const RenameItemModal = ({ 
  visible, 
  onCancel, 
  onConfirm, 
  item,
  existingNames = [],
  tree = {}
}) => {
  const [form] = Form.useForm();
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (visible && item) {
      form.setFieldValue('name', item.name);
      setValidationError('');
    }
  }, [visible, item, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const newName = values.name.trim();
      
      // Don't proceed if name hasn't changed
      if (newName === item.name) {
        onCancel();
        return;
      }
      
      // Validate name
      const validation = validateItemName(newName, item.type, existingNames);
      
      if (!validation.isValid) {
        setValidationError(validation.error);
        return;
      }

      setValidationError('');
      onConfirm(newName);
    } catch (error) {
      console.log('Validation failed:', error);
    }
  };

  const validateItemName = (name, itemType, existingNames) => {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: `${itemType === 'file' ? 'File' : 'Folder'} name is required` };
    }

    if (name.length > 255) {
      return { isValid: false, error: 'Name must be less than 255 characters' };
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(name)) {
      return { isValid: false, error: 'Name contains invalid characters: < > : " / \\ | ? *' };
    }

    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(name.toUpperCase())) {
      return { isValid: false, error: 'This name is reserved by the system' };
    }

    // Check for duplicate names (excluding current item)
    const otherNames = existingNames.filter(n => n !== item.name);
    if (otherNames.includes(name)) {
      return { isValid: false, error: `A ${itemType === 'file' ? 'file' : 'folder'} with this name already exists` };
    }

    if (itemType === 'file') {
      if (name.endsWith('.') || name.endsWith(' ')) {
        return { isValid: false, error: 'File name cannot end with a dot or space' };
      }
    }

    if (itemType === 'folder') {
      if (name.endsWith('.') || name.endsWith(' ')) {
        return { isValid: false, error: 'Folder name cannot end with a dot or space' };
      }
    }

    return { isValid: true, error: '' };
  };

  const handleNameChange = (e) => {
    const name = e.target.value;
    if (name.trim() && name !== item.name) {
      const validation = validateItemName(name, item.type, existingNames);
      setValidationError(validation.error || '');
    } else {
      setValidationError('');
    }
  };

  if (!item) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <div className="terminal-toggle active" style={{ 
            background: item.type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            borderColor: item.type === 'file' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'
          }}>
            {item.type === 'file' ? <FileOutlined className="terminal-icon" /> : <FolderOutlined className="terminal-icon" />}
          </div>
          <span className="text-slate-100 font-semibold text-sm">
            Rename {item.type === 'file' ? 'File' : 'Folder'}
          </span>
        </div>
      }
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Rename"
      cancelText="Cancel"
      className="rename-item-modal host-modal-style"
      width={460}
      transitionName="ant-zoom"
      maskTransitionName="ant-fade"
      styles={{
        body: { 
          padding: '20px',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(7,17,26,0.95))',
          color: '#e2e8f0',
          borderRadius: '0 0 12px 12px',
          backdropFilter: 'blur(20px)',
          opacity: 0,
          transform: 'scale(0.95) translateY(-10px)',
          animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
        },
        header: {
          background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
          borderBottom: `1px solid ${item.type === 'file' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
          color: '#e2e8f0',
          borderRadius: '12px 12px 0 0',
          padding: '16px 20px',
          minHeight: 'auto',
          opacity: 0,
          transform: 'translateY(-10px)',
          animation: 'modalHeaderEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards'
        },
        content: {
          backgroundColor: 'transparent',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          boxShadow: `0 20px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px ${item.type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
          border: 'none',
          opacity: 0,
          transform: 'scale(0.95)',
          animation: 'modalContentEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
        },
        footer: {
          background: 'linear-gradient(180deg, rgba(15,23,42,0.8), rgba(7,17,26,0.9))',
          borderTop: `1px solid ${item.type === 'file' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)'}`,
          borderRadius: '0 0 12px 12px',
          padding: '16px 20px',
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px'
        }
      }}
      okButtonProps={{
        className: 'modal-apply-btn animate-pulse-once'
      }}
      cancelButtonProps={{
        className: 'modal-cancel-btn'
      }}
      closeIcon={
        <div className="modal-close-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M13 1L1 13M1 1L13 13" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          </svg>
        </div>
      }
      destroyOnClose
    >
      <div className="space-y-4 modal-content-inner">
        <div className="text-slate-400 text-sm animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
          Current name: <span className="text-cyan-300 font-mono bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">{item.name}</span>
        </div>

        <Form form={form} layout="vertical">
          <Form.Item
            label={
              <span className="text-slate-300 text-sm font-medium animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                New {item.type === 'file' ? 'File' : 'Folder'} Name
              </span>
            }
            name="name"
            rules={[
              { required: true, message: `Please enter a new name` },
            ]}
            help={validationError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs mt-1 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
                <ExclamationCircleOutlined />
                <span>{validationError}</span>
              </div>
            )}
            validateStatus={validationError ? 'error' : ''}
          >
            <Input
              placeholder={`Enter new name for ${item.name}`}
              onChange={handleNameChange}
              autoFocus
              className="modal-input animate-fadeInUp"
              style={{ animationDelay: '0.2s' }}
              onPressEnter={handleOk}
            />
          </Form.Item>
        </Form>

        {/* Current Item Preview */}
        <div className="bg-gradient-to-r from-slate-800/40 to-slate-700/30 rounded-lg p-4 border border-slate-700/30 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M6 3V6M6 9H6.005" 
                stroke="currentColor" 
                strokeWidth="1.2" 
                strokeLinecap="round"
              />
            </svg>
            Current Item:
          </div>
          <div className="flex items-center gap-2 text-sm">
            {item.type === 'file' ? 
              <FileOutlined className="text-blue-400 transition-transform duration-300 hover:scale-110" /> : 
              <FolderOutlined className="text-amber-400 transition-transform duration-300 hover:scale-110" />
            }
            <span className="text-slate-300 font-medium">{item.name}</span>
            <span className="text-slate-500 text-xs">({item.type})</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
 const isOperationAllowed = () => {
    if (editingMode === 'host-only' && !isHost) {
      return false;
    }
    return true;
  };

// TreeNode Component
const TreeNode = ({ 
  nodeId, 
  node, 
  tree, 
  onSelectNode, 
  selectedNodeId, 
  onFileClick, 
  onRenameNode, 
  onDeleteNode, 
  activeFileId, 
  depth = 0,
  searchTerm,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOver,
  onContextMenu,
  animationDelay = 0,
  onCreateFile,
  onCreateFolder,
  onRequestRename,
  onRequestDelete,
  isDragging,
  dragPreview,onDragEnd,isOperationAllowed
}) => {
  const [isExpanded, setIsExpanded] = React.useState(depth < 2);
  const [isAnimating, setIsAnimating] = React.useState(false);
  
 
  if (!node) return null;
  
  // Skip rendering if node doesn't match search term (unless it's a parent of a matching node)
  const shouldRender = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());
  if (!shouldRender && (!node.children || node.children.length === 0)) return null;
  
  const isSelected = nodeId === selectedNodeId;
  const isActive = nodeId === activeFileId;
  const isFolder = node.type === 'folder';
  const isRoot = nodeId === 'root';
  
  
  const handleExpand = (e) => {
    e?.stopPropagation();
    setIsAnimating(true);
    setIsExpanded(!isExpanded);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleSelect = (e) => { 
    e.stopPropagation(); 
    onSelectNode(nodeId); 
    if (isFolder) {
      handleExpand(e);
    } else {
      onFileClick(nodeId);
    }
  };
  
  const handleDoubleClick = () => { 
    if (!isFolder) onFileClick(nodeId); 
    if (isFolder) handleExpand();
  };

  // Get file extension for styling
  const getFileIconColor = () => {
    if (!node.name || !node.name.includes('.')) return '#0ea5a4';
    
    const extension = node.name.split('.').pop().toLowerCase();
    const colorMap = {
      js: '#fbbf24',
      ts: '#3b82f6',
      jsx: '#0ea5a4',
      tsx: '#3b82f6',
      html: '#f97316',
      css: '#6366f1',
      py: '#3b82f6',
      java: '#f59e0b',
      cpp: '#2563eb',
      c: '#94a3b8',
      json: '#eab308',
      md: '#94a3b8',
      txt: '#94a3b8'
    };
    
    return colorMap[extension] || '#0ea5a4';
  };

  // Enhanced file badges with consistent styling
  const getFileBadge = (fileName) => {
    if (!fileName || typeof fileName !== 'string') return null;
    if (!fileName.includes('.')) return null;
    

    const extension = fileName.split('.').pop().toLowerCase();
    const badgeMap = {
      cpp: { text: 'C++', color: 'bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 border-blue-400/15' },
      java: { text: 'Java', color: 'bg-gradient-to-r from-amber-600/20 to-amber-500/20 text-amber-300 border-amber-400/15' },
      c: { text: 'C', color: 'bg-gradient-to-r from-slate-600/20 to-slate-500/20 text-slate-300 border-slate-400/15' },
      txt: { text: 'Text', color: 'bg-gradient-to-r from-slate-600/20 to-slate-500/20 text-slate-300 border-slate-400/15' },
      ts: { text: 'TS', color: 'bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 border-blue-400/15' },
      jsx: { text: 'JSX', color: 'bg-gradient-to-r from-cyan-600/20 to-cyan-500/20 text-cyan-300 border-cyan-400/15' },
      tsx: { text: 'TSX', color: 'bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 border-blue-400/15' },
      html: { text: 'HTML', color: 'bg-gradient-to-r from-orange-600/20 to-orange-500/20 text-orange-300 border-orange-400/15' },
      css: { text: 'CSS', color: 'bg-gradient-to-r from-indigo-600/20 to-indigo-500/20 text-indigo-300 border-indigo-400/15' },
      py: { text: 'PY', color: 'bg-gradient-to-r from-blue-600/20 to-blue-500/20 text-blue-300 border-blue-400/15' },
      json: { text: 'JSON', color: 'bg-gradient-to-r from-slate-600/20 to-slate-500/20 text-slate-300 border-slate-400/15' },
      md: { text: 'MD', color: 'bg-gradient-to-r from-slate-600/20 to-slate-500/20 text-slate-300 border-slate-400/15' },
      js: { text: 'JS', color: 'bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 text-yellow-300 border-yellow-400/15' }
    };

    const badge = badgeMap[extension];
    if (!badge) return null;

    return (
      <span className={`text-[9px] px-1 py-0.5 rounded-full border transition-all duration-300 hover:scale-105 backdrop-filter backdrop-blur-sm ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  // Enhanced file status indicators
  const getStatusIndicator = (node) => {
    const status = node.status || 'none';
    
    const statusMap = {
      modified: { class: 'bg-yellow-400 shadow-yellow-400/30', tooltip: 'Modified' },
      added: { class: 'bg-green-400 shadow-green-400/30', tooltip: 'Added' },
      deleted: { class: 'bg-red-400 shadow-red-400/30', tooltip: 'Deleted' },
      conflicted: { class: 'bg-purple-400 shadow-purple-400/30', tooltip: 'Conflicted' },
      none: { class: '', tooltip: '' }
    };
    
    const statusInfo = statusMap[status];
    if (!statusInfo.class || status === 'none') return null;
    
    return (
      <Tooltip title={statusInfo.tooltip} placement="top">
        <span 
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 hover:scale-125 shadow-sm ${statusInfo.class}`} 
        />
      </Tooltip>
    );
  };
  

  return (
    <div 
      className="transition-all duration-300 ease-out animate-fadeInUp"
      style={{ 
        animationDelay: `${animationDelay}ms`,
        animationFillMode: 'both'
      }}
    >
      <div 
        onClick={handleSelect} 
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, nodeId)}
        draggable={!isRoot && isOperationAllowed()}
        onDragStart={(e) => onDragStart(e, nodeId)}
        onDragOver={(e) => onDragOver(e, nodeId)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, nodeId)}
        onDragEnd={onDragEnd} // Add this line
        className={`
          flex items-center gap-2 py-1.5 px-3 cursor-pointer transition-all duration-400 ease-out group
          relative overflow-hidden backdrop-filter backdrop-blur-sm
          ${isSelected ? 
            'bg-gradient-to-r from-cyan-600/15 to-cyan-500/8 text-cyan-200 shadow-lg shadow-cyan-500/8 border border-cyan-500/15' : 
            'text-slate-300 hover:bg-gradient-to-r hover:from-slate-800/40 hover:to-slate-700/30 hover:backdrop-blur-md'
          }
          ${isActive ? 'ring-1 ring-cyan-400/40 shadow-cyan-400/15' : ''}
          ${dragOver === nodeId ? 'bg-gradient-to-r from-cyan-600/20 to-cyan-500/15 ring-2 ring-cyan-400/50 scale-[1.02]' : ''}
          ${isDragging === nodeId ? 'opacity-50 scale-95' : ''}
          hover:transform hover:translate-x-1 hover:scale-[1.02] hover:shadow-lg hover:shadow-slate-900/15
          rounded-md
          ${isRoot ? 'cursor-default hover:transform-none' : ''}
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {/* Drag handle indicator */}
        {!isRoot && (
          <div className="absolute left-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-1 h-4 bg-slate-500/30 rounded-full"></div>
          </div>
        )}

        {/* Rest of your TreeNode content */}
        {isFolder ? (
          <div className="flex items-center text-amber-400 transition-all duration-300 group-hover:text-amber-300">
            <div 
              className={`transition-transform duration-300 ease-out mr-1 ${isExpanded ? 'rotate-90' : 'rotate-0'} ${isAnimating ? 'scale-110' : 'scale-100'} ${isRoot ? 'invisible' : ''}`}
              onClick={handleExpand}
            >
              <CaretRightOutlined className="text-[10px]" />
            </div>
            <div className={`transition-all duration-300 ${isExpanded ? 'scale-110' : 'scale-100'} filter drop-shadow-sm`}>
              {isExpanded ? <FolderOpenOutlined className="text-xs" /> : <FolderOutlined className="text-xs" />}
            </div>
          </div>
        ) : (
          <FileOutlined 
            style={{ 
              color: getFileIconColor(),
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))'
            }} 
            className="transition-all duration-300 hover:scale-110 text-xs"
          />
        )}
        
        <span className="flex-1 truncate text-xs font-medium flex items-center gap-2 transition-all duration-300 min-w-0">
          <span className="transition-colors duration-300 group-hover:text-slate-100 truncate">
            {node.name}
          </span>
          {!isFolder && getFileBadge(node.name)}
          {getStatusIndicator(node)}
        </span>
        
       

{isSelected && !isRoot && isOperationAllowed() && ( // Add isOperationAllowed() check
  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-1 group-hover:translate-x-0">
    <Tooltip title="Rename" color="#0f172a">
      <Button 
        type="text" 
        size="small" 
        icon={<EditOutlined className="text-[10px]" />} 
        onClick={(e) => { 
          e.stopPropagation(); 
          onRequestRename(nodeId);
        }}
        className="h-5 w-5 min-w-5 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-300 rounded hover:scale-110"
      />
    </Tooltip>
    <Tooltip title="Delete" color="#0f172a">
      <Button 
        type="text" 
        size="small" 
        icon={<DeleteOutlined className="text-[10px]" />} 
        onClick={(e) => { 
          e.stopPropagation(); 
          onRequestDelete(nodeId);
        }}
        className="h-5 w-5 min-w-5 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-300 rounded hover:scale-110"
      />
    </Tooltip>
  </div>
)}
      </div>
      
      {isFolder && node.children && (
        <div 
          className={`ml-4 border-l border-slate-700/30 transition-all duration-300 ease-out overflow-hidden ${
            isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className={`transition-all duration-300 ${isExpanded ? 'transform translate-y-0' : 'transform -translate-y-1'}`}>
            {node.children.map((childId, index) => (
              <TreeNode 
               
                key={childId} 
                nodeId={childId} 
                node={tree[childId]} 
                tree={tree} 
                onSelectNode={onSelectNode} 
                selectedNodeId={selectedNodeId} 
                onFileClick={onFileClick} 
                onRenameNode={onRenameNode} 
                onDeleteNode={onDeleteNode} 
                activeFileId={activeFileId}
                depth={depth + 1}
                searchTerm={searchTerm}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                dragOver={dragOver}
                onContextMenu={onContextMenu}
                animationDelay={index * 50}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onRequestRename={onRequestRename}
                onRequestDelete={onRequestDelete}
                isDragging={isDragging}
                isOperationAllowed={isOperationAllowed}
                
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Context Menu Component
const ContextMenu = ({ 
  contextMenu, 
  setContextMenu, 
  tree, 
  onCreateFile, 
  onCreateFolder, 
  onRequestRename, 
  onRequestDelete ,editingMode = 'open', // Add this prop
  isHost = false, // Add this prop
}) => {
  if (!contextMenu.visible) return null;
  
  const node = tree[contextMenu.nodeId];
  const isFolder = node?.type === 'folder';
  const isRoot = contextMenu.nodeId === 'root';
  const canEdit = editingMode === 'open' || (editingMode === 'host-only' && isHost);
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 backdrop-filter backdrop-blur-sm bg-black/5"
        onClick={() => setContextMenu({ ...contextMenu, visible: false })}
      />
      
      {/* Context Menu */}
      <div 
        className="fixed bg-gradient-to-b from-slate-800/95 to-slate-900/95 backdrop-filter backdrop-blur-md shadow-2xl rounded-lg py-1 z-50 border border-slate-700/40 animate-contextMenuSlideIn min-w-40"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/30 mb-1">
          {node?.name || 'Actions'}
        </div>
        
        {isFolder && canEdit && ( // Add canEdit check
      <button 
        className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-gradient-to-r hover:from-cyan-600/15 hover:to-cyan-500/8 flex items-center gap-2 transition-all duration-300 hover:text-cyan-300"
        onClick={() => {
          onCreateFolder(contextMenu.nodeId);
          setContextMenu({ ...contextMenu, visible: false });
        }}
      >
        <PlusOutlined className="text-cyan-400 text-xs" /> 
        <span>New Folder</span>
      </button>
    )}
    
    {isFolder && canEdit && ( // Add canEdit check
      <button 
        className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-gradient-to-r hover:from-blue-600/15 hover:to-blue-500/8 flex items-center gap-2 transition-all duration-300 hover:text-blue-300"
        onClick={() => {
          onCreateFile(contextMenu.nodeId);
          setContextMenu({ ...contextMenu, visible: false });
        }}
      >
        <PlusOutlined className="text-blue-400 text-xs" /> 
        <span>New File</span>
      </button>
    )}
    
    {!isRoot && canEdit && ( // Add canEdit check
      <>
        <div className="h-px bg-slate-700/30 my-1" />
        
        <button 
          className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-gradient-to-r hover:from-blue-600/15 hover:to-blue-500/8 flex items-center gap-2 transition-all duration-300 hover:text-blue-300"
          onClick={() => {
            onRequestRename(contextMenu.nodeId);
            setContextMenu({ ...contextMenu, visible: false });
          }}
        >
          <EditOutlined className="text-blue-400 text-xs" /> 
          <span>Rename</span>
        </button>
        
        <div className="h-px bg-slate-700/30 my-1" />
        
        <button 
          className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-gradient-to-r hover:from-rose-600/15 hover:to-rose-500/8 flex items-center gap-2 transition-all duration-300 hover:text-rose-300"
          onClick={() => {
            onRequestDelete(contextMenu.nodeId);
            setContextMenu({ ...contextMenu, visible: false });
          }}
        >
          <DeleteOutlined className="text-rose-400 text-xs" /> 
          <span>Delete</span>
        </button>
      </>
    )}
      </div>
    </>
  );
};

const FileTree = ({ 
  tree, 
  selectedNodeId, 
  onSelectNode, 
  onCreateFile, 
  onCreateFolder, 
  onRenameNode, 
  onDeleteNode, 
  onFileClick, 
  activeFileId,
  onMoveNode,
  editingMode = 'open', 
  isHost = false, 
}) => {
  
  const rootNode = tree?.root;
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, nodeId: null });
  const isOperationAllowed = () => {
    if (editingMode === 'host-only' && !isHost) {
      return false;
    }
    return true;
  };
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Add these states to your FileTree component
const [draggedItemId, setDraggedItemId] = useState(null);
const [dragOver, setDragOver] = useState(null);
const [isDragging, setIsDragging] = useState(null);
  
  // Modal states
  const [createModal, setCreateModal] = useState({
    visible: false,
    type: 'file',
    parentNodeId: null,
    parentNode: null
  });

  const [renameModal, setRenameModal] = useState({
    visible: false,
    nodeId: null,
    node: null
  });

  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    nodeId: null,
    node: null
  });
  

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);
  
  // Context menu handler
  const handleContextMenu = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      nodeId: nodeId
    });
  };
  
// 

// Replace ALL your drag handlers with these:
const handleDragStart = (e, nodeId) => {
  if (nodeId === 'root' || !isOperationAllowed()) {
    e.preventDefault();
    return;
  }
  
  console.log('Drag start:', nodeId);
  
  // Use state to track the dragged item
  setDraggedItemId(nodeId);
  setIsDragging(nodeId);
  
  // Still set data for basic compatibility, but don't rely on it
  e.dataTransfer.setData('text/plain', nodeId);
  e.dataTransfer.effectAllowed = 'move';
  
  // Add a simple drag image
  const dragImage = document.createElement('div');
  dragImage.textContent = tree[nodeId]?.name || 'Item';
  dragImage.style.cssText = `
    position: absolute;
    top: -1000px;
    padding: 4px 8px;
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 4px;
    color: white;
    font-size: 12px;
  `;
  document.body.appendChild(dragImage);
  e.dataTransfer.setDragImage(dragImage, 0, 0);
  setTimeout(() => document.body.removeChild(dragImage), 0);
};

const handleDragOver = (e, nodeId) => {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('Drag over:', { draggedItemId, targetNodeId: nodeId });
  
  // Use state instead of dataTransfer
  const draggedNodeId = draggedItemId;
  
  if (!draggedNodeId) {
    console.log('No dragged node ID in state');
    e.dataTransfer.dropEffect = 'none';
    setDragOver(null);
    return;
  }
  
  const draggedNode = tree[draggedNodeId];
  const targetNode = tree[nodeId];
  
  // Validation checks
  if (!draggedNode || !targetNode || draggedNodeId === nodeId) {
    e.dataTransfer.dropEffect = 'none';
    setDragOver(null);
    return;
  }
  
  // Cannot drop into itself or its children
  const isDescendant = (tree, ancestorId, descendantId) => {
    const node = tree[ancestorId];
    if (!node || !node.children) return false;
    
    if (node.children.includes(descendantId)) return true;
    
    for (const childId of node.children) {
      if (isDescendant(tree, childId, descendantId)) return true;
    }
    
    return false;
  };

  if (draggedNode.type === 'folder' && isDescendant(tree, draggedNodeId, nodeId)) {
    e.dataTransfer.dropEffect = 'none';
    setDragOver(null);
    return;
  }
  
  // Only allow dropping into folders
  if (targetNode.type !== 'folder') {
    e.dataTransfer.dropEffect = 'none';
    setDragOver(null);
    return;
  }
  
  // Check for duplicate names in target folder
  if (targetNode.children) {
    const existingNames = targetNode.children.map(childId => tree[childId]?.name).filter(Boolean);
    if (existingNames.includes(draggedNode.name)) {
      e.dataTransfer.dropEffect = 'none';
      setDragOver(null);
      return;
    }
  }
  
  e.dataTransfer.dropEffect = 'move';
  setDragOver(nodeId);
};

const handleDragLeave = (e) => {
  e.preventDefault();
  e.stopPropagation();
  setDragOver(null);
};

const handleDrop = (e, targetNodeId) => {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('Drop:', { draggedItemId, targetNodeId });
  
  // Use state instead of dataTransfer
  const sourceNodeId = draggedItemId;
  
  if (!sourceNodeId || sourceNodeId === targetNodeId) {
    console.log('Invalid drop');
    setDragOver(null);
    setIsDragging(null);
    setDraggedItemId(null);
    return;
  }
  
  const sourceNode = tree[sourceNodeId];
  const targetNode = tree[targetNodeId];
  
  // Final validation before move
  if (!sourceNode || !targetNode || targetNode.type !== 'folder') {
    notification.error('Cannot move item to this location');
    setDragOver(null);
    setIsDragging(null);
    setDraggedItemId(null);
    return;
  }
  
  // Check for duplicates
  if (targetNode.children) {
    const existingNames = targetNode.children.map(childId => tree[childId]?.name).filter(Boolean);
    if (existingNames.includes(sourceNode.name)) {
      notification.error(`A ${sourceNode.type} with name "${sourceNode.name}" already exists in the target folder`);
      setDragOver(null);
      setIsDragging(null);
      setDraggedItemId(null);
      return;
    }
  }
  
  // Call the move callback
  if (onMoveNode) {
    console.log('Calling onMoveNode:', { sourceNodeId, targetNodeId });
    onMoveNode(sourceNodeId, targetNodeId);
    notification.success(`Moved ${sourceNode.type} to ${targetNode.name}`);
  } else {
    console.error('onMoveNode prop is not provided');
    notification.error('Move functionality not available');
  }
  
  setDragOver(null);
  setIsDragging(null);
  setDraggedItemId(null);
};

const handleDragEnd = (e) => {
  console.log('Drag end');
  // Clean up regardless of success/failure
  setDragOver(null);
  setIsDragging(null);
  setDraggedItemId(null);
};

 const handleCreateFile = (parentNodeId = selectedNodeId || 'root') => {
    if (!isOperationAllowed()) {
      message.warning('Only the host can create files in host-only mode');
      return;
    }
    
    const parentNode = tree[parentNodeId];
    if (!parentNode || parentNode.type !== 'folder') {
      console.warn('Cannot create file in non-folder node');
      return;
    }

    setCreateModal({
      visible: true,
      type: 'file',
      parentNodeId: parentNodeId,
      parentNode: parentNode
    });
  }

 const handleCreateFolder = (parentNodeId = selectedNodeId || 'root') => {
    if (!isOperationAllowed()) {
      message.warning('Only the host can create folders in host-only mode');
      return;
    }
    
    const parentNode = tree[parentNodeId];
    if (!parentNode || parentNode.type !== 'folder') {
      message.error('Cannot create folder in this location');
      return;
    }

    setCreateModal({
      visible: true,
      type: 'folder',
      parentNodeId: parentNodeId,
      parentNode: parentNode
    });
  };

  const handleModalConfirm = (itemName) => {
    if (createModal.type === 'file') {
      onCreateFile(createModal.parentNodeId, itemName);
    } else {
      onCreateFolder(createModal.parentNodeId, itemName);
    }
    setCreateModal({ ...createModal, visible: false });
  };

  const handleModalCancel = () => {
    setCreateModal({ ...createModal, visible: false });
  };

  // Rename handlers
  const handleRequestRename = (nodeId) => {
    if (!isOperationAllowed()) {
      message.warning('Only the host can rename items in host-only mode');
      return;
    }
    
    const node = tree[nodeId];
    if (!node || nodeId === 'root') {
      message.error('Cannot rename root directory');
      return;
    }

    setRenameModal({
      visible: true,
      nodeId: nodeId,
      node: node
    });
  };

  const handleRenameConfirm = (newName) => {
    if (renameModal.nodeId) {
      onRenameNode(renameModal.nodeId, newName);
    }
    setRenameModal({ visible: false, nodeId: null, node: null });
  };

  const handleRenameCancel = () => {
    setRenameModal({ visible: false, nodeId: null, node: null });
  };

  // Delete handlers
  const handleRequestDelete = (nodeId) => {
    if (!isOperationAllowed()) {
      message.warning('Only the host can delete items in host-only mode');
      return;
    }
    
    const node = tree[nodeId];
    if (!node) return;

    setDeleteModal({
      visible: true,
      nodeId: nodeId,
      node: node,
      isRoot: nodeId === 'root'
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteModal.nodeId && deleteModal.nodeId !== 'root') {
      onDeleteNode(deleteModal.nodeId);
    }
    setDeleteModal({ visible: false, nodeId: null, node: null, isRoot: false });
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ visible: false, nodeId: null, node: null, isRoot: false });
  };

  // Get existing names in the parent directory for duplicate checking
  const getExistingNames = (parentNodeId) => {
    if (!parentNodeId || !tree[parentNodeId]) {
      return [];
    }
    
    const parentNode = tree[parentNodeId];
    if (!parentNode.children) {
      return [];
    }
    
    return parentNode.children.map(childId => tree[childId]?.name).filter(Boolean);
  };

  // Get existing names for rename (excluding current item)
  const getRenameExistingNames = () => {
    if (!renameModal.nodeId || !tree[renameModal.nodeId]) {
      return [];
    }
    
    const currentNode = tree[renameModal.nodeId];
    const parentNodeId = Object.keys(tree).find(key => 
      tree[key]?.children?.includes(renameModal.nodeId)
    );
    
    if (!parentNodeId || !tree[parentNodeId]?.children) {
      return [];
    }
    
    return tree[parentNodeId].children
      .map(childId => tree[childId]?.name)
      .filter(name => name && name !== currentNode.name);
  };

  return (
    <>
      <div className="file-tree-container animate-slideInUp">
        {/* Header */}
        <div className="file-tree-header">
          <div className="header-content">
            <div className="title-section group">
              <div className="icon-container">
                <FaFolder className="title-icon" />
              </div>
              <div className="title-text-container">
                <div className="title-text">Explorer</div>
                <p className="subtitle-text">
                  {Object.keys(tree).length - 1} items
                </p>
              </div>
            </div>
            
            
            <div className="search-section">
              <div className={`search-container ${isSearchFocused ? 'search-focused' : ''}`}>
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="search-input"
                />
                <SearchOutlined className="search-icon" />
              </div>
            </div>
          </div>
          
          

<div className="action-buttons">
  <Tooltip 
    title={isOperationAllowed() ? "New File" : "Only host can create files"} 
    color="#0f172a"
  >
    <button 
      onClick={() => handleCreateFile()}
      className={`action-button new-file-button ${!isOperationAllowed() ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={!isOperationAllowed()}
    >
      <PlusOutlined className="button-icon" />
    </button>
  </Tooltip>
  <Tooltip 
    title={isOperationAllowed() ? "New Folder" : "Only host can create folders"} 
    color="#0f172a"
  >
    <button 
      onClick={() => handleCreateFolder()}
      className={`action-button new-folder-button ${!isOperationAllowed() ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={!isOperationAllowed()}
    >
      <FolderOutlined className="button-icon" />
    </button>
  </Tooltip>
</div>
        </div>
        
        {/* File Tree Content */}
        <div className="file-tree-body">
          {rootNode && (
            <div className="animate-fadeIn">
              <TreeNode 
                nodeId={'root'} 
                node={rootNode} 
                tree={tree} 
                onSelectNode={onSelectNode} 
                selectedNodeId={selectedNodeId} 
                onFileClick={onFileClick} 
                onRenameNode={onRenameNode} 
                onDeleteNode={onDeleteNode} 
                activeFileId={activeFileId}
                searchTerm={searchTerm}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                dragOver={dragOver}
                onContextMenu={handleContextMenu}
                animationDelay={0}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRequestRename={handleRequestRename}
                onRequestDelete={handleRequestDelete}
                isDragging={isDragging}
                onDragEnd={handleDragEnd}
                isOperationAllowed={isOperationAllowed}
              />
            </div>
          )}
          
          {/* Empty State */}
          {(!rootNode || Object.keys(tree).length <= 1) && (
            <div className="empty-state animate-fadeIn">
              <div className="empty-icon-container">
                <FolderOpenOutlined className="empty-icon" />
              </div>
              <div className="empty-text">
                <h3 className="empty-title">No files yet</h3>
                <p className="empty-subtitle">
                  Get started by creating your first file or organizing your project with folders
                </p>
                <div className="empty-actions">
                  <button 
                    onClick={() => handleCreateFile('root')}
                    className="empty-action-button primary-button"
                  >
                    <PlusOutlined className="empty-button-icon" /> 
                    New File
                  </button>
                  <button 
                    onClick={() => handleCreateFolder('root')}
                    className="empty-action-button secondary-button"
                  >
                    <FolderOutlined className="empty-button-icon" /> 
                    New Folder
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Search Results Empty State */}
          {searchTerm && rootNode && Object.keys(tree).length > 1 && (
            <div className="search-empty-state animate-fadeIn">
              <SearchOutlined className="search-empty-icon" />
              <p className="search-empty-text">No files match "{searchTerm}"</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Context Menu */}
      <ContextMenu 
        contextMenu={contextMenu} 
        setContextMenu={setContextMenu} 
        tree={tree}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onRequestRename={handleRequestRename}
        onRequestDelete={handleRequestDelete}
        editingMode={editingMode}
      />

      {/* Create Item Modal */}
      <CreateItemModal
        visible={createModal.visible}
        onCancel={handleModalCancel}
        onConfirm={handleModalConfirm}
        type={createModal.type}
        parentNode={createModal.parentNode}
        existingNames={getExistingNames(createModal.parentNodeId)}
        tree={tree}
      />

      {/* Rename Item Modal */}
      <RenameItemModal
        visible={renameModal.visible}
        onCancel={handleRenameCancel}
        onConfirm={handleRenameConfirm}
        item={renameModal.node}
        existingNames={getRenameExistingNames()}
        tree={tree}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        visible={deleteModal.visible}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={deleteModal.node?.name}
        itemType={deleteModal.node?.type}
        isRoot={deleteModal.isRoot}
      />

      <style jsx>{`
      /* Create File Button */
.modal-file-create-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.8)) !important;
  border: 1px solid rgba(59, 130, 246, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 100px !important;
}

.modal-file-create-btn:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 1), rgba(37, 99, 235, 0.9)) !important;
  border-color: rgba(59, 130, 246, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4) !important;
}

/* Create Folder Button */
.modal-folder-create-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 8px 20px !important;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.8)) !important;
  border: 1px solid rgba(245, 158, 11, 0.3) !important;
  color: white !important;
  border-radius: 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  backdrop-filter: blur(8px) !important;
  position: relative !important;
  overflow: hidden !important;
  min-width: 120px !important;
}

.modal-folder-create-btn:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(217, 119, 6, 0.9)) !important;
  border-color: rgba(245, 158, 11, 0.5) !important;
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 8px 25px rgba(245, 158, 11, 0.4) !important;
}

/* Button shimmer effects */
.modal-file-create-btn::before,
.modal-folder-create-btn::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: -100% !important;
  width: 100% !important;
  height: 100% !important;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent) !important;
  transition: left 0.5s !important;
}

.modal-file-create-btn:hover::before,
.modal-folder-create-btn:hover::before {
  left: 100% !important;
}

/* File/Folder specific terminal toggle animations */
.create-item-modal .terminal-toggle,
.rename-item-modal .terminal-toggle {
  animation: gentleBounce 2s ease-in-out infinite !important;
}

@keyframes gentleBounce {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.05) translateY(-1px); }
}
      /* Root Delete Modal Specific Styles */
.root-delete-modal .ant-modal-footer {
  display: flex !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  padding: 16px 20px !important;
}

.root-delete-modal .terminal-toggle {
  animation: gentlePulse 2s ease-in-out infinite !important;
}

/* File Delete Modal Specific Styles */
.file-delete-modal .ant-modal-footer {
  display: flex !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  padding: 16px 20px !important;
}

.file-delete-modal .terminal-toggle {
  animation: shake 0.8s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

@keyframes shake {
  0%, 100% { transform: translateX(0) rotate(0); }
  25% { transform: translateX(-2px) rotate(-1deg); }
  75% { transform: translateX(2px) rotate(1deg); }
}

/* Enhanced warning animations */
@keyframes gentlePulse {
  0%, 100% { 
    transform: scale(1); 
    background: rgba(245, 158, 11, 0.1);
  }
  50% { 
    transform: scale(1.05); 
    background: rgba(245, 158, 11, 0.15);
  }
}

/* File type specific styling */
.file-delete-modal .folder-warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05));
  border: 1px solid rgba(245, 158, 11, 0.2);
  animation: pulseWarning 2s ease-in-out infinite;
}

@keyframes pulseWarning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* Enhanced item preview */
.file-delete-modal .item-preview {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6));
  border: 1px solid rgba(14, 165, 164, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-delete-modal .item-preview:hover {
  border-color: rgba(14, 165, 164, 0.3);
  transform: translateY(-1px);
}

/* Modal content animations */
.modal-content-inner {
  opacity: 0;
  animation: modalContentInner 0.3s ease 0.2s forwards;
}

@keyframes modalContentInner {
  to {
    opacity: 1;
  }
}

.animate-fadeInUp {
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-pulse-once {
  animation: pulseOnce 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes pulseOnce {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}
        /* ==========================
           Enhanced Animations & Transitions
           ========================== */
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes contextMenuSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes iconBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-3px); }
          60% { transform: translateY(-1px); }
        }

        .animate-slideInUp {
          animation: slideInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .animate-contextMenuSlideIn {
          animation: contextMenuSlideIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ==========================
           Main Container
           ========================== */
        .file-tree-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #0a1628 0%, #0f172a 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          position: relative;
          overflow: hidden;
          font-size: 12px;
        }

        .file-tree-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at top right, rgba(14, 165, 164, 0.02), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .file-tree-container > * {
          position: relative;
          z-index: 1;
        }

        /* ==========================
           Header Styling
           ========================== */
        .file-tree-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,17,27,0.95));
          border-bottom: 1px solid rgba(14, 165, 164, 0.08);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }

        .file-tree-header:hover {
          border-bottom-color: rgba(14, 165, 164, 0.15);
          background: linear-gradient(135deg, rgba(15,23,42,0.98), rgba(7,17,27,0.98));
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .title-icon {
          color: #0ea5a4;
          font-size: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.2));
        }

        .title-section.group:hover .icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.2), rgba(14, 116, 144, 0.2));
          border-color: rgba(14, 165, 164, 0.3);
          transform: translateY(-1px) scale(1.05);
          box-shadow: 0 6px 20px rgba(14, 165, 164, 0.15);
        }

        .title-section.group:hover .title-icon {
          transform: scale(1.1);
          animation: iconBounce 0.6s ease;
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.4));
        }

        .title-text-container {
          min-width: 0;
          flex: 1;
        }

        .title-text {
          font-size: 12px;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: 0.3px;
          text-transform: uppercase;
          transition: all 0.3s ease;
          margin-bottom: 1px;
        }

        .title-section.group:hover .title-text {
          color: #0ea5a4;
          text-shadow: 0 0 6px rgba(14, 165, 164, 0.2);
        }

        .subtitle-text {
          font-size: 10px;
          color: #64748b;
          margin: 0;
          transition: color 0.3s ease;
        }

        .title-section.group:hover .subtitle-text {
          color: #94a3b8;
        }

        /* ==========================
           Search Section
           ========================== */
        .search-section {
          flex-shrink: 0;
        }

        .search-container {
          position: relative;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .search-input {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(14, 165, 164, 0.08);
          border-radius: 8px;
          padding: 6px 10px 6px 28px;
          font-size: 11px;
          color: #e2e8f0;
          width: 120px;
          outline: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(8px);
          height: 28px;
        }

        .search-input::placeholder {
          color: #94a3b8;
          font-style: italic;
          font-size: 10px;
        }

        .search-input:hover {
          border-color: rgba(14, 165, 164, 0.15);
          background: rgba(15, 23, 42, 0.8);
          transform: translateY(-1px);
        }

        .search-input:focus,
        .search-focused .search-input {
          border-color: rgba(14, 165, 164, 0.4);
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 0 0 2px rgba(14, 165, 164, 0.1), 0 6px 20px rgba(2,6,23,0.3);
          transform: translateY(-1px) scale(1.02);
          width: 140px;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 10px;
          transition: all 0.3s ease;
          pointer-events: none;
        }

        .search-focused .search-icon,
        .search-input:focus + .search-icon {
          color: #0ea5a4;
          transform: translateY(-50%) scale(1.1);
        }

        /* ==========================
           Action Buttons
           ========================== */
        .action-buttons {
          display: flex;
          gap: 6px;
          align-items: center;
          margin-top: 8px;
        }

        .action-button {
          background: transparent;
          border: 1px solid rgba(148,163,184,0.08);
          color: #94a3b8;
          border-radius: 6px;
          padding: 4px 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(4px);
          width: 24px;
          height: 24px;
        }

        .action-button:hover {
          color: #0ea5a4;
          border-color: rgba(14, 165, 164, 0.2);
          background: rgba(14, 165, 164, 0.1);
          transform: translateY(-1px) scale(1.1);
          box-shadow: 0 3px 10px rgba(14, 165, 164, 0.15);
        }

        .button-icon {
          font-size: 10px;
          transition: all 0.3s ease;
        }

        .action-button:hover .button-icon {
          transform: scale(1.1);
        }

        .new-file-button:hover {
          color: #06d6a0;
          border-color: rgba(6, 214, 160, 0.2);
          background: rgba(6, 214, 160, 0.1);
          box-shadow: 0 3px 10px rgba(6, 214, 160, 0.15);
        }

        .new-folder-button:hover {
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.2);
          background: rgba(251, 191, 36, 0.1);
          box-shadow: 0 3px 10px rgba(251, 191, 36, 0.15);
        }

        /* ==========================
           Body and Content
           ========================== */
        .file-tree-body {
         user-select: none;
          flex: 1;
          overflow-y: auto;
          padding: 12px 0;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.02));
        }
          /* Smooth drag image transitions */
.treeNode-drag-image {
  background: linear-gradient(135deg, #0f172a, #07111b);
  border: 1px solid rgba(14, 165, 164, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  color: #e2e8f0;
  font-size: 12px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
  z-index: 10000;
}

/* Drop zone highlighting */
.drop-zone-active {
  background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.1)) !important;
  border: 2px dashed rgba(14, 165, 164, 0.4) !important;
}

/* Disabled drop zones */
.drop-zone-disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
}

        .file-tree-body::-webkit-scrollbar {
          width: 4px;
        }

        .file-tree-body::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.3);
          border-radius: 2px;
        }

        .file-tree-body::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 164, 0.2);
          border-radius: 2px;
          transition: background 0.3s ease;
        }

        .file-tree-body::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 164, 0.4);
        }

        /* ==========================
           Empty State
           ========================== */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px 16px;
          text-align: center;
          opacity: 0.8;
          flex: 1;
          min-height: 200px;
        }

        .empty-icon-container {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.1), rgba(14, 116, 144, 0.1));
          border: 1px solid rgba(14, 165, 164, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          transition: all 0.3s ease;
        }

        .empty-icon {
          font-size: 18px;
          color: #94a3b8;
          opacity: 0.6;
          transition: all 0.3s ease;
        }

        .empty-state:hover .empty-icon-container {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.15), rgba(14, 116, 144, 0.15));
          border-color: rgba(14, 165, 164, 0.25);
          transform: translateY(-1px);
        }

        .empty-state:hover .empty-icon {
          color: #0ea5a4;
          opacity: 0.8;
          transform: scale(1.1);
        }

        .empty-text {
          max-width: 200px;
        }

        .empty-title {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 4px;
          transition: color 0.3s ease;
        }

        .empty-subtitle {
          font-size: 10px;
          color: #64748b;
          margin-bottom: 16px;
          line-height: 1.4;
          transition: color 0.3s ease;
        }

        .empty-state:hover .empty-title {
          color: #cbd5e1;
        }

        .empty-state:hover .empty-subtitle {
          color: #94a3b8;
        }

        .empty-actions {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .empty-action-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          border: none;
        }

        .primary-button {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.8), rgba(6, 182, 212, 0.8));
          color: white;
          box-shadow: 0 2px 8px rgba(14, 165, 164, 0.2);
        }

        .primary-button:hover {
          background: linear-gradient(135deg, rgba(14, 165, 164, 0.9), rgba(6, 182, 212, 0.9));
          transform: translateY(-1px) scale(1.05);
          box-shadow: 0 4px 15px rgba(14, 165, 164, 0.3);
        }

        .secondary-button {
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.6), rgba(51, 65, 85, 0.6));
          color: #e2e8f0;
          box-shadow: 0 2px 8px rgba(71, 85, 105, 0.2);
        }

        .secondary-button:hover {
          background: linear-gradient(135deg, rgba(71, 85, 105, 0.8), rgba(51, 65, 85, 0.8));
          transform: translateY(-1px) scale(1.05);
          box-shadow: 0 4px 15px rgba(71, 85, 105, 0.3);
        }

        .empty-button-icon {
          font-size: 10px;
          transition: all 0.3s ease;
        }

        .empty-action-button:hover .empty-button-icon {
          transform: scale(1.1);
        }

        .primary-button:hover .empty-button-icon {
          transform: scale(1.1) rotate(90deg);
        }

        /* ==========================
           Search Empty State
           ========================== */
        .search-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px 16px;
          text-align: center;
          opacity: 0.7;
          margin-top: 20px;
        }

        .search-empty-icon {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 8px;
          opacity: 0.5;
        }

        .search-empty-text {
          font-size: 11px;
          color: #64748b;
          margin: 0;
        }

        /* ==========================
           Mobile Responsiveness
           ========================== */
        @media (max-width: 768px) {
          .file-tree-header {
            padding: 10px 12px;
          }

          .header-content {
            gap: 10px;
          }

          .title-text {
            font-size: 11px;
          }

          .icon-container {
            width: 24px;
            height: 24px;
          }

          .title-icon {
            font-size: 10px;
          }

          .search-input {
            width: 100px;
            font-size: 10px;
            padding: 5px 8px 5px 26px;
          }

          .search-input:focus,
          .search-focused .search-input {
            width: 120px;
          }

          .action-buttons {
            gap: 4px;
            margin-top: 6px;
          }

          .action-button {
            width: 20px;
            height: 20px;
            padding: 3px;
          }

          .button-icon {
            font-size: 9px;
          }
        }

        @media (max-width: 480px) {
          .file-tree-header {
            padding: 8px 10px;
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .title-section {
            justify-content: center;
          }

          .search-section {
            display: flex;
            justify-content: center;
          }

          .search-input {
            width: 100%;
            max-width: 160px;
          }

          .search-input:focus,
          .search-focused .search-input {
            width: 100%;
          }

          .action-buttons {
            justify-content: center;
            margin-top: 8px;
          }

          .empty-actions {
            flex-direction: column;
            align-items: center;
          }

          .empty-action-button {
            width: 120px;
            justify-content: center;
          }
        }

        /* ==========================
           Enhanced Focus States
           ========================== */
        .action-button:focus,
        .empty-action-button:focus,
        .search-input:focus {
          outline: 2px solid rgba(14, 165, 164, 0.4) !important;
          outline-offset: 1px !important;
        }

        /* ==========================
           Performance Optimizations
           ========================== */
        .file-tree-container {
          will-change: transform;
          backface-visibility: hidden;
        }

        .action-button,
        .search-container,
        .empty-action-button {
          will-change: transform, box-shadow;
        }

        /* ==========================
           Text Selection
           ========================== */
        .file-tree-container *::selection {
          background: rgba(14, 165, 164, 0.2);
          color: #f1f5f9;
        }

        /* ==========================
           Enhanced Tooltip Styling
           ========================== */
        :global(.ant-tooltip-inner) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
          color: #e2e8f0 !important;
          border-radius: 6px !important;
          backdrop-filter: blur(12px) !important;
          box-shadow: 0 6px 20px rgba(2,6,23,0.4) !important;
          font-size: 11px !important;
          padding: 6px 8px !important;
        }

        :global(.ant-tooltip-arrow::before) {
          background: linear-gradient(135deg, #0f172a, #071126) !important;
          border: 1px solid rgba(14, 165, 164, 0.2) !important;
        }

        /* ==========================
           Enhanced Button Styling
           ========================== */
        :global(.ant-btn) {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        :global(.ant-btn:hover) {
          transform: translateY(-0.5px) scale(1.05) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        }

        /* ==========================
           Accessibility Improvements
           ========================== */
        .action-button:focus-visible,
        .empty-action-button:focus-visible,
        .search-input:focus-visible {
          outline: 2px solid rgba(14, 165, 164, 0.6) !important;
          outline-offset: 1px !important;
        }

        /* ==========================
           Smooth Scrolling
           ========================== */
        * {
          scroll-behavior: smooth;
        }

        /* ==========================
           Enhanced Glow Effects
           ========================== */
        .title-icon {
          filter: drop-shadow(0 0 4px rgba(14, 165, 164, 0.2));
        }

        .title-section.group:hover .title-icon {
          filter: drop-shadow(0 0 8px rgba(14, 165, 164, 0.4));
        }
      `}</style>
    </>
  );
};

export default FileTree;
