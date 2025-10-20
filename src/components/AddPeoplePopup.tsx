'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

import Close from './icons/Close';
import PersonAdd from './icons/PersonAdd';

interface Contact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AddPeoplePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite?: (selectedEmails: string[]) => void;
}

const AddPeoplePopup = ({ isOpen, onClose, onInvite }: AddPeoplePopupProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set()
  );

  // Mock suggested contacts - in production, these would come from your backend/Clerk
  const suggestedContacts: Contact[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com',
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
    },
    {
      id: '3',
      name: 'Bob Wilson',
      email: 'bob.wilson@example.com',
    },
  ];

  const filteredContacts = suggestedContacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleContact = (email: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedContacts(newSelected);
  };

  const handleInvite = () => {
    if (onInvite) {
      onInvite(Array.from(selectedContacts));
    }
    setSelectedContacts(new Set());
    setSearchTerm('');
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (email: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-orange-500',
      'bg-teal-500',
    ];
    const index =
      email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) %
      colors.length;
    return colors[index];
  };

  if (!isOpen) return null;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Wrapper */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        {/* Modal */}
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-medium text-meet-black">Add people</h2>
          <button
            onClick={onClose}
            className="hover:bg-gray-100 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <Close />
          </button>
        </div>

        {/* Invite Tab */}
        <div className="px-6 pt-4">
          <button className="flex items-center gap-2 text-primary font-medium text-sm pb-2 border-b-2 border-primary">
            <PersonAdd />
            <span>Invite</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-6 pt-4 pb-2">
          <input
            type="text"
            placeholder="Enter name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
        </div>

        {/* Suggested Contacts */}
        <div className="px-6 py-2 max-h-80 overflow-y-auto">
          {searchTerm === '' && (
            <p className="text-xs text-gray-500 mb-2 font-medium">
              Suggested contacts
            </p>
          )}
          {filteredContacts.length === 0 && searchTerm !== '' && (
            <p className="text-sm text-gray-500 py-4 text-center">
              No contacts found
            </p>
          )}
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center gap-3 py-3 hover:bg-gray-50 rounded-lg px-2 cursor-pointer transition-colors"
              onClick={() => handleToggleContact(contact.email)}
            >
              {/* Avatar */}
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0',
                  contact.avatar ? '' : getAvatarColor(contact.email)
                )}
              >
                {contact.avatar ? (
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(contact.name)
                )}
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-meet-black truncate">
                  {contact.name}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {contact.email}
                </p>
              </div>

              {/* Checkbox */}
              <input
                type="checkbox"
                checked={selectedContacts.has(contact.email)}
                onChange={() => handleToggleContact(contact.email)}
                className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
              />
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-primary hover:bg-blue-50 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={selectedContacts.size === 0}
            className={clsx(
              'px-6 py-2 text-sm font-medium rounded transition-colors',
              selectedContacts.size > 0
                ? 'bg-primary text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            Invite ({selectedContacts.size})
          </button>
        </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default AddPeoplePopup;
