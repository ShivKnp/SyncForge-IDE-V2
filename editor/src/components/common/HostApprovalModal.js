// src/components/common/HostApprovalModal.js
import React from 'react';
import { Modal, Button, Space } from 'antd';

const HostApprovalModal = ({ visible, operation, onApprove, onReject, onCancel }) => {
  if (!operation) return null;

  return (
    <Modal
      title="Operation Approval Required"
      open={visible}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={() => onReject(operation)}>Reject</Button>
          <Button type="primary" onClick={() => onApprove(operation)}>
            Approve
          </Button>
        </Space>
      }
    >
      <div className="p-4">
        <p className="text-gray-300 mb-2">A participant requested to:</p>
        <p className="text-white font-semibold mb-4">{operation.description}</p>
        <p className="text-gray-400 text-sm">Would you like to approve this operation?</p>
      </div>
    </Modal>
  );
};

export default HostApprovalModal;