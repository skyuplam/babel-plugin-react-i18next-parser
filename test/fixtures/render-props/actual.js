/* eslint-disable */
import React from 'react';
import { I18n } from 'react-i18next';


function TranslatableView() {
  return (
    <I18n ns={['react', 'anotherNamespace']}>
      {
        (t, { i18n, ready }) => (
          <div>
            <h1>{t('keyFromDefault')}</h1>
            <p>{t('anotherNamespace:key.from.another.namespace', { /* options t options */ })}</p>
          </div>
        )
      }
    </I18n>
  )
}
