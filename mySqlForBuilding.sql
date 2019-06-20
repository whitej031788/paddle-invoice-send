
select *
from business_buyers
where vendor_id = 33113

select * from business_buyers

select * from business_contracts

select * from business_payables

select * from business_payments

delete bp
from business_payables bp
inner join business_payments pay
on bp.business_payment_id = pay.id
inner join business_contracts bc
on pay.business_contract_id = bc.id
where bc.created_at > '2019-06-19 15:39:42'
and bc.business_buyer_id in (select id from business_buyers bbb
where bbb.vendor_id = 33113
and bbb.created_at > '2019-06-19 15:39:42');

delete bp
from business_payments bp
inner join business_contracts bc
on bp.business_contract_id = bc.id
where bc.created_at > '2019-06-19 15:39:42'
and bc.business_buyer_id in (select id from business_buyers bbb
where bbb.vendor_id = 33113
and bbb.created_at > '2019-06-19 15:39:42');

delete from business_contracts
where created_at > '2019-06-19 15:39:42'
and business_buyer_id in (select id from business_buyers
where vendor_id = 33113
and created_at > '2019-06-19 15:39:42');

delete from business_addresses
where created_at > '2019-06-19 15:39:42'
and business_buyer_id in (select id from business_buyers
where vendor_id = 33113
and created_at > '2019-06-19 15:39:42');

delete from business_buyers
where vendor_id = 33113
and created_at > '2019-06-19 15:39:42';