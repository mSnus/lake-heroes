import React from 'react';
import '../../styles/IncomeDefence.css';

type IncomeDefenceProps = {
  income: number;
  defence: number;
  bonusTypeIcon: string;
  incomeHint?: string;
  defenceHint?: string;
};

const IncomeDefence: React.FC<IncomeDefenceProps> = (props) => {
  return (
        <div className="income-defence-wrapper" style={{borderBottom: 'solid 1px #eeeeee50', textAlign:'center', paddingBottom: '2rem'}}>
            <div
            >{props.incomeHint ? `${props.incomeHint}: ` : ''}<span className="value">{props.income ?? 0}</span>{props.bonusTypeIcon}{' '}</div>

            <div>{props.defenceHint ? `${props.defenceHint}: ` : ''}<span className="value">{props.defence}</span>🛡️</div>
        </div>
  );
};

export default IncomeDefence;
