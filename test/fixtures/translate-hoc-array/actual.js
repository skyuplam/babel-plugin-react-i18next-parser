/* eslint-disable */
import React from 'react'
import { translate, Trans, Interpolate } from 'react-i18next'


class Test extends React.Component {
  render () {
    const { t, count } = this.props
    return (
      <div>
        <h1>{t('first')}</h1>
        <p>{t('second', 'this is a default message.')}</p>
        <p>{t('third', 'default message', 'contextA')}</p>
        <p>{t('fourth', { defaultValue: 'default message' })}</p>
        <p>{t('fifth', { defaultValue: '{{var}} value' })}</p>
        <p>{t('six' + 'th')}</p>
        <p>{t(['seventh.first', 'seventh.fallbackA', 'seventh.fallbackB'])}</p>
        <p>
          {t('eighth.friend', { context: 'male' })}
        </p>
        <p>
          {t('eighth.friend', { context: 'female' })}
        </p>
        <p>
          {t('eighth.friends', { count })}
        </p>
        <p>
          {t('eighth.contextplural', { context: 'contextA', count })}
        </p>
        <p>
          {t('ninth', { name: 'name', defaultValue: 'My name is {{name}}.' })}
        </p>
        <p>
          {t('anotherNS:first')}
        </p>
      </div>
    )
  }
}

export default translate(['react', 'anotherNS'])(Test)
