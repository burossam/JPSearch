-- 埼玉県の市区町村（デモ用）
-- 冪等: code が同じなら upsert
-- 注意: ここでは既存のUIデモで使っているコード体系（JIS市区町村コード）を優先

BEGIN;

-- さいたま市10区
INSERT INTO municipalities(code, prefecture_id, name, municipality_type)
SELECT x.code, p.id, x.name, x.municipality_type
FROM (
  VALUES
    ('11101','さいたま市西区','ward'),
    ('11102','さいたま市北区','ward'),
    ('11103','さいたま市大宮区','ward'),
    ('11104','さいたま市見沼区','ward'),
    ('11105','さいたま市中央区','ward'),
    ('11106','さいたま市桜区','ward'),
    ('11107','さいたま市浦和区','ward'),
    ('11108','さいたま市南区','ward'),
    ('11109','さいたま市緑区','ward'),
    ('11110','さいたま市岩槻区','ward')
) AS x(code, name, municipality_type)
JOIN prefectures p ON p.code = '11'
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    prefecture_id = EXCLUDED.prefecture_id,
    municipality_type = EXCLUDED.municipality_type;

-- さいたま市以外の市（デモ）
INSERT INTO municipalities(code, prefecture_id, name, municipality_type)
SELECT x.code, p.id, x.name, 'city'
FROM (
  VALUES
    ('11201','川越市'),
    ('11202','熊谷市'),
    ('11203','川口市'),
    ('11206','行田市'),
    ('11207','秩父市'),
    ('11208','所沢市'),
    ('11209','飯能市'),
    ('11210','加須市'),
    ('11211','本庄市'),
    ('11212','東松山市'),
    ('11214','春日部市'),
    ('11215','狭山市'),
    ('11216','羽生市'),
    ('11217','鴻巣市'),
    ('11218','深谷市'),
    ('11219','上尾市'),
    ('11221','草加市'),
    ('11222','越谷市'),
    ('11223','蕨市'),
    ('11224','戸田市'),
    ('11225','入間市'),
    ('11227','朝霞市'),
    ('11228','志木市'),
    ('11229','和光市'),
    ('11230','新座市'),
    ('11231','桶川市'),
    ('11232','久喜市'),
    ('11233','北本市'),
    ('11234','八潮市'),
    ('11235','富士見市'),
    ('11237','三郷市'),
    ('11238','蓮田市'),
    ('11239','坂戸市'),
    ('11240','幸手市'),
    ('11241','鶴ヶ島市'),
    ('11242','日高市'),
    ('11243','吉川市'),
    ('11245','ふじみ野市'),
    ('11246','白岡市')
) AS x(code, name)
JOIN prefectures p ON p.code = '11'
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    prefecture_id = EXCLUDED.prefecture_id,
    municipality_type = EXCLUDED.municipality_type;

COMMIT;
